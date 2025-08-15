const cds = require('@sap/cds')
const { SELECT, UPDATE, INSERT, DELETE } = cds.ql
const { generateCustomRequestId } = require('./utils/sequence')
const { generateReqNextStatus } = require('./utils/status')
const { Decision, RequestType, TaskType, Status, Variant } = require('./utils/enums')
const { postComment } = require('./utils/comments')
const { sendEmail } = require('./utils/mail')
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { fetchIasUser } = require('./utils/ias')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')
const { normalizeVariant } = require('./utils/variant')

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
        language: 'EN',
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
  const {
    CORE_COMMENTS,
    CORE_ATTACHMENTS,
    MON_WF_TASK,
    CORE_USERS,
    AUTH_MATRIX,
    CONFIG_LDATA,
  } = srv.entities

  if (typeof srv.on === 'function') {
    srv.on('error', (err) => {
      if (err.code === 'SQLITE_CONSTRAINT' || /unique constraint/i.test(err.message)) {
        err.statusCode = 409
        err.message = 'Record already exists'
        return
      }
      if (err.response && err.response.data && err.response.data.message) {
        err.statusCode = err.response.status
        err.message = err.response.data.message
        return
      }
      if (err.cause && err.cause.message) {
        err.message = err.cause.message
      }
      err.statusCode = err.statusCode || 500
      err.message = err.message || 'Unexpected error'
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
            decision,
            context: {},
          },
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        return req.error(502, `Workflow update failed: ${error.message}`)
      }

      // Step 2: Transactional DB update
      const tx = cds.transaction(req)
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
              DECISION: decision,
              PROCESSOR: user,
              ACTUAL_COMPLETION: now,
              UPDATED_BY: user,
              UPDATED_DATETIME: now,
            })
            .where({ TASK_INSTANCE_ID })
        )

        if (
          TASK_TYPE === TaskType.TE_REQUESTER ||
          TASK_TYPE === TaskType.TE_RESO_TEAM ||
          TASK_TYPE === TaskType.TE_RESO_LEAD
        ) {
          const statusCd = generateReqNextStatus(
            RequestType.TE,
            TASK_TYPE,
            decision
          )

          const teSrUpdate = {
            STATUS_CD: statusCd,
            CASE_BCG,
            SRC_PROB_CD,
            UPDATED_BY: user,
            UPDATED_DATETIME: now,
            PROCESSOR: user,
          }
          if (decision === Decision.APR) {
            teSrUpdate.RESOLVED_DATETIME = now
          } else if (decision === Decision.REJ) {
            teSrUpdate.IS_CLAR_REQ_DATETIME = now
          } else if (decision === Decision.ESL) {
            teSrUpdate.ESCALATED_DATETIME = now
          }
          await tx.run(
            UPDATE('BTP.TE_SR').set(teSrUpdate).where({ REQ_TXN_ID })
          )

          if (statusCd === Status.RSL && wfInstanceId) {
            await tx.run(
              UPDATE('BTP.MON_WF_PROCESS')
                .set({
                  WF_STATUS: 'COMPLETED',
                  UPDATED_BY: user,
                  ACTUAL_COMPLETION: now,
                })
                .where({ WF_INSTANCE_ID: wfInstanceId })
            )
          }
        }
      } catch (error) {
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

        req.error(500, 'Technical error occurred, contact system admin')
      }

      return { status: 'success' }
    })

    srv.on('postComment', async (req) => {
      const { comment, transactionId, createdBy, taskType, decision } = req.data
      const user = createdBy || (req.user && req.user.id)
      const tx = srv.transaction(req)
      await postComment(comment, transactionId, user, taskType, decision, tx)
      return { status: 'success' }
    })

    srv.on('massCreateUsers', async (req) => {
      const { entries } = req.data || {}
      const list = Array.isArray(entries) ? entries : []
      list.forEach((e) => {
        if (!e.language) e.language = 'EN'
      })
      const tx = srv.transaction(req)
      await tx.run(INSERT.into(CORE_USERS).entries(list))
      return { inserted: list.length }
    })

    srv.on('massDeleteUsers', async (req) => {
      const tx = srv.transaction(req)
      const result = await tx.run(
        DELETE.from(CORE_USERS).where({ language: 'EN' })
      )
      return { deleted: result }
    })

    srv.on('massCreateAuthMatrix', async (req) => {
      const { entries } = req.data || {}
      const list = Array.isArray(entries)
        ? entries.map((e) => ({ language: 'EN', ...e }))
        : []
      const tx = srv.transaction(req)
      await tx.run(INSERT.into(AUTH_MATRIX).entries(list))
      return { inserted: list.length }
    })

    srv.on('massDeleteAuthMatrix', async (req) => {
      const tx = srv.transaction(req)
      const result = await tx.run(
        DELETE.from(AUTH_MATRIX).where({ language: 'EN' })
      )
      return { deleted: result }
    })

    srv.on('massCreateConfigLdata', async (req) => {
      const { entries } = req.data || {}
      const list = Array.isArray(entries)
        ? entries.map((e) => ({ language: 'EN', ...e }))
        : []
      const tx = srv.transaction(req)
      await tx.run(INSERT.into(CONFIG_LDATA).entries(list))
      return { inserted: list.length }
    })

    srv.on('massDeleteConfigLdata', async (req) => {
      const tx = srv.transaction(req)
      const result = await tx.run(
        DELETE.from(CONFIG_LDATA).where({ language: 'EN' })
      )
      return { deleted: result }
    })

    srv.on('CREATE', 'CORE_ATTACHMENTS', async (req, next) => {
      const list = Array.isArray(req.data) ? req.data : [req.data]
      list.forEach((e) => {
        if (!e.language) e.language = 'EN'
      })
      try {
        await next()
      } catch (error) {
        req.error(error)
        return
      }
      const tx = srv.transaction(req)
      const key = list[0] && list[0].REQ_TXN_ID
      if (!key) return []
      return tx.run(SELECT.from(CORE_ATTACHMENTS).where({ REQ_TXN_ID: key }))
    })

    srv.on('CREATE', 'CORE_COMMENTS', async (req) => {
      const list = Array.isArray(req.data) ? req.data : [req.data]
      const entries = list.map((entry) => {
        const obj = {}
        obj.COMMENTS = entry.COMMENTS ?? entry.comment
        obj.REQ_TXN_ID = entry.REQ_TXN_ID ?? entry.transactionId
        obj.CREATED_BY =
          entry.CREATED_BY ?? entry.createdBy ?? (req.user && req.user.id)
        if (entry.UUID) obj.UUID = entry.UUID
        if (entry.language) obj.language = entry.language
        if (entry.REQUEST_ID) obj.REQUEST_ID = entry.REQUEST_ID
        if (entry.USER_TYPE) obj.USER_TYPE = entry.USER_TYPE
        if (entry.COMMENT_TYPE) obj.COMMENT_TYPE = entry.COMMENT_TYPE
        if (entry.COMMENT_EVENT) obj.COMMENT_EVENT = entry.COMMENT_EVENT
        if (entry.EVENT_STATUS_CD) obj.EVENT_STATUS_CD = entry.EVENT_STATUS_CD
        if (!obj.language) obj.language = 'EN'
        return obj
      })
      const tx = srv.transaction(req)
      try {
        await tx.run(INSERT.into(CORE_COMMENTS).entries(entries))
      } catch (error) {
        req.error(error)
        return
      }
      const key = entries[0] && entries[0].REQ_TXN_ID
      if (!key) return []
      return tx.run(SELECT.from(CORE_COMMENTS).where({ REQ_TXN_ID: key }))
    })
  }

  srv.before('CREATE', 'TE_SR', async (req) => {
    const tx = cds.transaction(req)
    const user = req.user && req.user.id
    const scimId = req.data['user-scim-id'] || req.data.user_scim_id
    if (scimId) {
      try {
        const jwt = retrieveJwt(req)
        const { data } = await executeHttpRequest(
          { destinationName: 'CIS_SCIM_API', jwt },
          { method: 'GET', url: `/scim/Users/${scimId}` }
        )
        const email = (data.emails || []).find((e) => e.primary)?.value
        if (email) {
          const existing = await tx.run(
            SELECT.one.from('BTP.CORE_USERS').where({
              USER_EMAIL: email,
              language: 'EN'
            })
          )
          if (!existing) {
            const enterprise =
              data['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] || {}
            await tx.run(
              INSERT.into('BTP.CORE_USERS').entries({
                USER_EMAIL: email,
                language: 'EN',
                USER_ID: enterprise.employeeNumber,
                USER_HP: data.phoneNumbers?.find(
                  (p) => p.primary && p.type === 'work'
                )?.value,
                USER_FNAME: data.name?.givenName,
                USER_LNAME: data.name?.familyName,
                IS_ACTIVE: 'Y',
                CREATED_BY: user,
                UPDATED_BY: user,
              })
            )
          }
        }
      } catch (error) {
        req.warn(`Failed to sync CORE_USERS: ${error.message}`)
      }
    }
    try {
      req.data.REQ_TXN_ID = req.data.REQ_TXN_ID || cds.utils.uuid()
      if (!req.data.language) req.data.language = 'EN'
      req.data.REQUEST_TYPE = RequestType.TE
      req.data.TASK_TYPE = TaskType.TE_REQUESTER
      const decision = req.data.DECISION
      if (decision === Decision.DRF) {
        req.data.DRAFT_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: req.data.REQUEST_TYPE,
          isDraft: true,
        })
      } else if (decision === Decision.SUB) {
        req.data.REQUEST_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: req.data.REQUEST_TYPE,
        })
      }
      req.data.STATUS_CD = generateReqNextStatus(
        RequestType.TE,
        req.data.TASK_TYPE,
        decision
      )
    } catch (error) {
      req.error(500, `Failed to prepare TE_SR: ${error.message}`)
    }
  })

  srv.before('PATCH', 'TE_SR', async (req) => {
    if (!req.data || !req.data.REQ_TXN_ID) return
    const tx = cds.transaction(req)
    try {
      const { REQUEST_ID } = await tx.run(
        SELECT.one
          .from('BTP.TE_SR')
          .columns('REQUEST_ID')
          .where({ REQ_TXN_ID: req.data.REQ_TXN_ID })
      )
      req._oldRequestId = REQUEST_ID
      if (!REQUEST_ID && req.data.DECISION === Decision.SUB) {
        req.data.REQUEST_ID = await generateCustomRequestId(tx, {
          prefix: 'CASE',
          requestType: RequestType.TE,
        })
      }
      if (req.data.DECISION) {
        const taskType = req.data.TASK_TYPE || TaskType.TE_REQUESTER
        req.data.STATUS_CD = generateReqNextStatus(
          RequestType.TE,
          taskType,
          req.data.DECISION
        )
      } else {
        delete req.data.STATUS_CD
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
        req.data.CREATED_DATETIME = task.createdAt
        // ASSIGNED_GROUP and TASK_TYPE are taken from the request payload
      } else {
        req.error(404, `No task instance found for workflowInstanceId ${SWF_INSTANCE_ID}`)
      }
    } catch (error) {
      req.error(502, `Failed to fetch task instance: ${error.message}`)
    }
  })

  srv.before('READ', 'TE_REPORT_VIEW', async (req) => {
    console.log('TE_REPORT_VIEW input parameters:', JSON.stringify(req.data, null, 2))
    const scimId =
      req.data['user-scim-id'] ||
      req.data.user_scim_id ||
      (req.req && req.req.query && req.req.query['user-scim-id'])
    let variant =
      req.data.VARIENT ||
      (req.req && req.req.query && req.req.query.VARIENT)
    variant = normalizeVariant(variant)
    console.log('TE_REPORT_VIEW scimId:', scimId, 'variant:', variant)
    if (!scimId) return

    let groups = []
    let email
    try {
      const jwt = retrieveJwt(req)
      const { data } = await executeHttpRequest(
        { destinationName: 'CIS_SCIM_API', jwt },
        { method: 'GET', url: `/scim/Users/${scimId}` }
      )
      const rawGroups = (data && data.groups) || []
      groups = rawGroups
        .map((g) => (typeof g === 'string' ? g : g.display || g.value))
        .filter((g) => g && g.startsWith('STE_TE_'))
      email = (data.emails || []).find((e) => e.primary)?.value
      console.log('TE_REPORT_VIEW groups:', groups)
      console.log('TE_REPORT_VIEW email:', email)
    } catch (error) {
      return req.error(502, `Failed to fetch user info: ${error.message}`)
    }

    const append = (cond) => {
      if (req.query.SELECT.where) req.query.SELECT.where.push('and', ...cond)
      else req.query.SELECT.where = cond
    }

    switch (variant) {
      case Variant.MY_CASES: {
        if (!email) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        append([{ ref: ['CREATED_BY'] }, '=', { val: email }])
        break
      }
        case Variant.CLOSED_CASES: {
          const cond = []
          if (email) {
            cond.push({ ref: ['SR_PROCESSOR'] }, '=', { val: email })
          }
          if (groups.length) {
            if (cond.length) cond.push('or')
            cond.push(
              '(',
              { ref: ['ASSIGNED_GROUP'] },
              'in',
              { list: groups.map((g) => ({ val: g })) },
              'and',
              { ref: ['STATUS_CD'] }, '=', { val: Status.RSL },
              ')'
            )
          }
          if (!cond.length) {
            req.query.SELECT.where = ['1', '=', '0']
          } else {
            append(cond)
          }
          break
        }
      case Variant.OPEN_CASES: {
        const teamGroups = groups.filter((g) => g.startsWith('STE_TE_RESO_TEAM_'))
        if (!teamGroups.length && !email) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        const cond = []
        if (teamGroups.length) {
          cond.push(
            '(',
            { ref: ['ASSIGNED_GROUP'] },
            'in',
            { list: teamGroups.map((g) => ({ val: g })) },
            'and',
            { ref: ['STATUS_CD'] },
            '=',
            { val: Status.PRT },
            ')'
          )
        }
        if (email) {
          if (cond.length) cond.push('or')
          cond.push({ ref: ['TASK_PROCESSOR'] }, '=', { val: email })
        }
        append(cond)
        break
      }
      case Variant.TOTAL_CASES: {
        const adminGroups = groups.filter((g) => g.startsWith('STE_TE_SUPR_ADMN'))
        if (!adminGroups.length) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        append([
          { ref: ['ASSIGNED_GROUP'] },
          'in',
          { list: adminGroups.map((g) => ({ val: g })) }
        ])
        break
      }
      case Variant.SLA_BREACH_CASES: {
        const leadGroups = groups.filter((g) => g.startsWith('STE_TE_RESO_LEAD_'))
        if (!leadGroups.length && !email) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        const cond = []
        if (leadGroups.length) {
          cond.push(
            '(',
            { ref: ['ASSIGNED_GROUP'] },
            'in',
            { list: leadGroups.map((g) => ({ val: g })) },
            'and',
            { ref: ['STATUS_CD'] },
            '=',
            { val: Status.PRL },
            ')'
          )
        }
        if (email) {
          if (cond.length) cond.push('or')
          cond.push({ ref: ['TASK_PROCESSOR'] }, '=', { val: email })
        }
        append(cond)
        break
      }
      default: {
        if (!groups.length) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        append([
          { ref: ['ASSIGNED_GROUP'] },
          'in',
          { list: groups.map((g) => ({ val: g })) }
        ])
      }
    }

    console.log(
      'TE_REPORT_VIEW query before execution:',
      JSON.stringify(req.query, null, 2)
    )
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
        try {
          if ([Status.PRT, Status.PRL, Status.CLR].includes(item.STATUS_CD)) {
            item.MON_WF_TASK = await db.run(
              SELECT.from(MON_WF_TASK)
                .where({ REQ_TXN_ID: key })
                .orderBy('UPDATED_DATETIME desc')
            )
          } else {
            item.MON_WF_TASK = []
          }
        } catch (error) {
          req.warn(
            `Error fetching MON_WF_TASK for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.MON_WF_TASK = []
        }
      })
    )
  })

  if (typeof srv.on === 'function') {
    srv.on('userInfo', async (req) => {
      try {
        return await fetchIasUser(req)
      } catch (error) {
        if (error && (error.statusCode === 401 || /Missing JWT/i.test(error.message))) {
          req.error(401, 'Missing JWT')
        } else {
          req.error(502, `Failed to fetch IAS user: ${error.message}`)
        }
      }
    })
  }

}
