const cds = require('@sap/cds')
const { SELECT, UPDATE } = cds.ql
const { generateCustomRequestId } = require('./utils/sequence')
const { generateReqNextStatus } = require('./utils/status')
const { Decision, RequestType, TaskType } = require('./utils/enums')
const { sendEmail } = require('./utils/mail')

module.exports = (srv) => {
  const { CORE_COMMENTS, CORE_ATTACHMENTS } = srv.entities

  if (typeof srv.on === 'function') {
    srv.on('error', (err) => {
      if (err.code === 'SQLITE_CONSTRAINT' || /unique constraint/i.test(err.message)) {
        err.statusCode = 409
        err.message = 'Record already exists'
      } else {
        err.statusCode = err.statusCode || 500
        err.message = err.message || 'Unexpected error'
      }
    })

    srv.on('processTaskUpdate', async (req) => {
      const {
        TASK_INSTANCE_ID,
        TASK_TYPE,
        DECISION: decision,
        REQ_TXN_ID,
        CASE_BCG,
        SRC_PROB_CD,
      } = req.data

      const user = req.user && req.user.id

      // Step 1: Update workflow task via destination
      try {
        const wfSrv = await cds.connect.to('sap_process_automation_service')
        const wfSrvForUser = wfSrv.tx(req)
        await wfSrvForUser.send({
          method: 'PATCH',
          path: `/public/workflow/rest/v1/task-instances/${TASK_INSTANCE_ID}`,
          data: {
            status: 'COMPLETED',
            decision: decision && decision.toLowerCase(),
            context: {},
          },
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        return req.error(502, `Workflow update failed: ${error.message}`)
      }

      // Step 2: Transactional DB update
      const tx = srv.transaction(req)
      const now = new Date()
      let wfInstanceId
      try {
        const existingTask = await tx.run(
          SELECT.one.from('BTP.MON_WF_TASK').where({ TASK_INSTANCE_ID })
        )
        wfInstanceId = existingTask && existingTask.WF_INSTANCE_ID

        await tx.run(
          UPDATE('BTP.MON_WF_TASK')
            .set({
              USER_ACTION: decision,
              ACTUAL_COMPLETION: now,
              UPDATED_BY: user,
              UPDATED_DATETIME: now,
            })
            .where({ TASK_INSTANCE_ID })
        )

        if (
          TASK_TYPE === TaskType.TE_REQUESTER ||
          TASK_TYPE === TaskType.TE_RESO ||
          TASK_TYPE === TaskType.TE_RESO_LEAD
        ) {
          const statusCd = generateReqNextStatus(
            RequestType.TE,
            TASK_TYPE,
            decision
          )

          await tx.run(
            UPDATE('BTP.TE_SR')
              .set({
                STATUS_CD: statusCd,
                CASE_BCG,
                SRC_PROB_CD,
                UPDATED_BY: user,
                UPDATED_DATETIME: now,
              })
              .where({ REQ_TXN_ID })
          )
        }

        await tx.commit()
      } catch (error) {
        await tx.rollback(error)

        const body = [
          `Exception: ${error.message}`,
          `REQ_TXN_ID: ${REQ_TXN_ID}`,
          `REQUEST_TYPE: ${RequestType.TE}`,
          `TASK_TYPE: ${TASK_TYPE}`,
          `DECISION: ${decision}`,
          `TASK_INSTANCE_ID: ${TASK_INSTANCE_ID}`,
          `WF_INSTANCE_ID: ${wfInstanceId}`,
        ].join('\n')

        await sendEmail(
          `BTP TE Technical Error - ${REQ_TXN_ID}`,
          'nagavaraprasad.bandaru@stengg.com',
          'srisaisatya.mamidi@stengg.com',
          body
        )

        return req.error(
          500,
          'Technical error occurred, contact system admin'
        )
      }

      return { status: 'success' }
    })
  }

  srv.before('CREATE', 'TE_SR', async (req) => {
    const tx = cds.transaction(req)
    try {
      req.data.REQUEST_TYPE = RequestType.TE
      const decision = req.data.DECISION
      if (decision === Decision.DRAFT) {
        req.data.DRAFT_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: req.data.REQUEST_TYPE,
          isDraft: true,
        })
      } else if (decision === Decision.SUBMIT) {
        req.data.REQUEST_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: req.data.REQUEST_TYPE,
        })
      }
    } catch (error) {
      req.error(500, `Failed to prepare TE_SR: ${error.message}`)
    }
  })

  srv.before('CREATE', 'MON_WF_PROCESS', async (req) => {
    const tx = cds.transaction(req)
    try {
      req.data.REQUEST_ID = await generateCustomRequestId(tx, {
        prefix: 'CASE',
        requestType: req.data.REQUEST_TYPE,
      })
    } catch (error) {
      req.error(500, `Failed to create workflow: ${error.message}`)
    }
  })

  srv.after('READ', 'TE_SR', async (results, req) => {
    if (results == null) return
    const db = srv.transaction(req)
    const list = Array.isArray(results) ? results : [results]
    await Promise.all(
      list.map(async (item) => {
        if (!item) return
        const key = item.REQ_TXN_ID
        if (!key) return
        try {
          item.CORE_COMMENTS = await db.run(
            SELECT.from(CORE_COMMENTS).where({ REQ_TXN_ID: key })
          )
        } catch (error) {
          req.warn(
            `Error fetching CORE_COMMENTS for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.CORE_COMMENTS = []
        }
        try {
          item.CORE_ATTACHMENTS = await db.run(
            SELECT.from(CORE_ATTACHMENTS).where({ REQ_TXN_ID: key })
          )
        } catch (error) {
          req.warn(
            `Error fetching CORE_ATTACHMENTS for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.CORE_ATTACHMENTS = []
        }
      })
    )
  })

}
