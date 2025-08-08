const cds = require('@sap/cds')
const { SELECT, UPDATE, INSERT } = cds.ql
const { generateCustomRequestId } = require('./utils/sequence')
const { generateReqNextStatus } = require('./utils/status')
const { Decision, RequestType, TaskType, Status } = require('./utils/enums')
const { sendEmail } = require('./utils/mail')
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')

async function triggerWorkflow(te_sr, user) {
  const workflowPayload = {
    definitionId:
      'us10.stengg-sap-btp-qas.stecasemanagement.caseManagementMainProcess',
    context: {
      caseDetails: {
        CaseType: 'TE',
        Priority: 'HIGH',
        RequestId: te_sr.REQUEST_ID,
        RequesterEmail: te_sr.CREATED_BY,
        RequesterId: te_sr.REQUESTER_ID,
        SRCategory: te_sr.SRV_CAT_CD,
        TransactionId: te_sr.REQ_TXN_ID,
      },
    },
  }

  try {
    const response = await executeHttpRequest(
      { destinationName: 'sap_process_automation_service' },
      {
        method: 'POST',
        url: '/public/workflow/rest/v1/workflow-instances',
        data: workflowPayload,
      }
    )

    const payload = response.data || {}
    const now = new Date()

    await cds.run(
      INSERT.into('BTP.MON_WF_PROCESS').entries({
        WF_INSTANCE_ID: payload.id,
        WF_DESC: payload.subject,
        WF_SUBJ: payload.subject,
        WF_STATUS: payload.status,
        REQUEST_TYPE: RequestType.TE,
        REQUEST_ID: te_sr.REQUEST_ID,
        REQ_TXN_ID: te_sr.REQ_TXN_ID,
        CREATED_BY: user,
        CREATED_DATETIME: now,
        UPDATED_BY: user,
        UPDATED_DATETIME: now,
      })
    )
  } catch (err) {
    console.warn('Error triggering workflow:', err.message)
  }
}

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

          if (statusCd === Status.RESOLVED && wfInstanceId) {
            await tx.run(
              UPDATE('BTP.MON_WF_PROCESS')
                .set({
                  WF_STATUS: 'COMPLETED',
                  UPDATED_BY: user,
                  COMPLETED_BY: user,
                  ACTUAL_COMPLETION: now,
                })
                .where({ WF_INSTANCE_ID: wfInstanceId })
            )
          }
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

  srv.before('PATCH', 'TE_SR', async (req) => {
    if (!req.data || !req.data.REQ_TXN_ID) return
    const tx = cds.transaction(req)
    try {
      const { REQUEST_ID } = await tx.run(
        SELECT.one.from('BTP.TE_SR').columns('REQUEST_ID').where({
          REQ_TXN_ID: req.data.REQ_TXN_ID,
        })
      )
      req._oldRequestId = REQUEST_ID
      if (!REQUEST_ID && req.data.DECISION === Decision.SUBMIT) {
        req.data.REQUEST_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: RequestType.TE,
        })
      }
    } catch (error) {
      req.error(500, `Failed to prepare TE_SR: ${error.message}`)
    }
  })

  srv.after('CREATE', 'TE_SR', async (data, req) => {
    if (!data || !data.REQUEST_ID) return
    try {
      await triggerWorkflow(data, req.user && req.user.id)
    } catch (error) {
      req.warn(`Workflow trigger failed: ${error.message}`)
    }
  })

  srv.after('PATCH', 'TE_SR', async (_, req) => {
    if (!req.data || !req.data.REQ_TXN_ID) return
    if (req._oldRequestId) return
    try {
      const tx = srv.transaction(req)
      const latest = await tx.run(
        SELECT.one.from('BTP.TE_SR').where({ REQ_TXN_ID: req.data.REQ_TXN_ID })
      )
      if (latest && latest.REQUEST_ID) {
        await triggerWorkflow(latest, req.user && req.user.id)
      }
    } catch (error) {
      req.warn(`Workflow trigger failed: ${error.message}`)
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

  srv.before('CREATE', 'MON_WF_TASK', async (req) => {
    const { SWF_INSTANCE_ID } = req.data

    delete req.data.TASK_INSTANCE_ID

    if (!SWF_INSTANCE_ID) return

    try {
      const wfSrv = await cds.connect.to('sap_process_automation_service')
      const wfSrvForUser = wfSrv.tx(req)
      const tasks = await wfSrvForUser.send({
        method: 'GET',
        path: `/public/workflow/rest/v1/task-instances?workflowInstanceId=${SWF_INSTANCE_ID}`,
      })

      if (Array.isArray(tasks) && tasks.length > 0) {
        const task = tasks[0]
        req.data.TASK_INSTANCE_ID = task.id
        req.data.SWF_INSTANCE_ID = task.workflowInstanceId
        req.data.TASK_STATUS = task.status
        req.data.TASK_SUBJ = task.subject
        req.data.ASSIGNED_GROUP =
          Array.isArray(task.recipientGroups) && task.recipientGroups.length > 0
            ? task.recipientGroups[0]
            : null
        req.data.CREATED_DATETIME = task.createdAt
      } else {
        req.error(404, `No task instance found for workflowInstanceId ${SWF_INSTANCE_ID}`)
      }
    } catch (error) {
      req.error(502, `Failed to fetch task instance: ${error.message}`)
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
