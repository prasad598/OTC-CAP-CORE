const cds = require('@sap/cds')
const { SELECT, UPDATE, INSERT, DELETE, UPSERT } = cds.ql
const { generateCustomRequestId } = require('./utils/sequence')
const { generateReqNextStatus } = require('./utils/status')
const {
  Decision,
  RequestType,
  TaskType,
  Status,
  Variant
} = require('./utils/enums')
const { deriveCommentDetails } = require('./utils/comments')
const { sendEmail } = require('./utils/mail')
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { fetchIasUser } = require('./utils/ias')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')
const { normalizeVariant } = require('./utils/variant')
const { calculateSLA } = require('./utils/sla')
const handleError = require('./utils/error')

const registeredCommentHooks = new WeakSet()
const enrichCommentRows = async (input) => {
  const rows = Array.isArray(input) ? input : [input]
  for (const row of rows) {
    const {
      TASK_TYPE,
      DECISION,
      COMMENTS,
      REQ_TXN_ID,
      CREATED_BY,
      ...existing
    } = row
    const needsEnrichment =
      TASK_TYPE !== undefined ||
      DECISION !== undefined ||
      existing.USER_TYPE == null ||
      existing.COMMENT_TYPE == null ||
      existing.COMMENT_EVENT == null ||
      existing.EVENT_STATUS_CD == null ||
      existing.CREATED_BY_MASKED == null
    if (needsEnrichment) {
      const payload = {
        ...existing,
        REQ_TXN_ID,
        REQUEST_ID: existing.REQUEST_ID ?? null,
        COMMENTS,
        CREATED_BY,
        language: existing.language || 'EN',
      }
      Object.assign(
        payload,
        deriveCommentDetails(TASK_TYPE, DECISION, CREATED_BY)
      )
      Object.assign(row, payload)
    }
    delete row.TASK_TYPE
    delete row.DECISION
    delete row.REQUEST_TYPE
  }
}

const registerCommentHooks = (db) => {
  if (!db || registeredCommentHooks.has(db)) return
  registeredCommentHooks.add(db)
  db.before(['CREATE', 'INSERT'], async (req) => {
    const targetName = req?.target?.name || ''
    if (!/CORE_COMMENTS$/i.test(targetName)) return
    const data = req.data ?? req
    await enrichCommentRows(data)
  })
}

if (cds.db) registerCommentHooks(cds.db)
cds.on('connect', registerCommentHooks)
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

  if (te_sr.EC_DATE) {
    workflowPayload.context.caseDetails.DueCompletion = new Date(
      `${te_sr.EC_DATE}T23:59:59.999+08:00`
    ).toISOString()
  }

  console.log('workflowPayload', workflowPayload)

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
    console.error('Error triggering workflow:', err)
  }
}

module.exports = (srv) => {
  const {
    CORE_COMMENTS,
    CORE_ATTACHMENTS,
    MON_WF_TASK,
    MON_WF_PROCESS,
    CORE_USERS,
    AUTH_MATRIX,
    CONFIG_LDATA,
    CONFIG_PHDATA,
    TE_SR,
  } = srv.entities

  srv.before('CREATE', 'CORE_COMMENTS', async (req) => {
    if (!req?.data) return
    await enrichCommentRows(req.data)
  })

  if (CONFIG_LDATA && typeof srv.on === 'function') {
    srv.on('READ', CONFIG_LDATA, async (req, next) => {
      if (req.query.SELECT?.orderBy) {
        return next()
      }
      const q = SELECT.from(req.target)
      if (req.query.SELECT?.columns) q.columns(req.query.SELECT.columns)
      if (req.query.SELECT?.where) q.where(req.query.SELECT.where)
      q.orderBy({ ref: ['SEQUENCE'] })
      return cds.tx(req).run(q)
    })
  }


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
        CASE_BCG_CD,
        SRC_PROB,
        RESO_REMARKS,
        UPDATED_BY,
      } = req.data

      const user = UPDATED_BY || (req.user && req.user.id)
      let wfResponseCode
      // Step 1: Update workflow task via destination
      try {
        const wfSrv = await cds.connect.to('sap_process_automation_service')
        const wfSrvForUser = wfSrv.tx(req)
        const wfResponse = await wfSrvForUser.send({
          method: 'PATCH',
          path: `/public/workflow/rest/v1/task-instances/${TASK_INSTANCE_ID}`,
          data: {
            status: 'COMPLETED',
            decision,
            context: {},
          },
          headers: { 'Content-Type': 'application/json' },
        })
        wfResponseCode =
          (wfResponse && (wfResponse.status || wfResponse.statusCode)) || 202

        if (wfResponseCode < 200 || wfResponseCode >= 300) {
          const err = new Error(
            (wfResponse &&
              wfResponse.data &&
              (wfResponse.data.error &&
                wfResponse.data.error.message ||
                wfResponse.data.message)) ||
              `Workflow service returned status ${wfResponseCode}`
          )
          err.status = wfResponseCode
          err.response = wfResponse
          return handleError(err, wfResponseCode)
        }
      } catch (error) {
        return handleError(error)
      }

      // Step 2: Transactional DB update
      const tx = cds.transaction(req)
      const now = new Date()
      let wfInstanceId
      let dbResponseCode
      try {
        const existingTask = await tx.run(
          SELECT.one.from(MON_WF_TASK).where({ TASK_INSTANCE_ID })
        )
        wfInstanceId = existingTask && existingTask.WF_INSTANCE_ID
        console.log(
          `Fetched MON_WF_TASK for TASK_INSTANCE_ID ${TASK_INSTANCE_ID}`
        )

        await tx.run(
          UPDATE(MON_WF_TASK)
            .set({
              DECISION: decision,
              PROCESSOR: user,
              ACTUAL_COMPLETION: now,
              COMPLETED_DATE: now,
              TASK_STATUS: 'COMPLETED',
              UPDATED_BY: user,
              UPDATED_DATETIME: now,
            })
            .where({ TASK_INSTANCE_ID })
        )
        console.log(
          `Updated MON_WF_TASK for TASK_INSTANCE_ID ${TASK_INSTANCE_ID}`
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
            CASE_BCG_CD,
            SRC_PROB,
            ...(RESO_REMARKS !== undefined && { RESO_REMARKS }),
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
            UPDATE(TE_SR).set(teSrUpdate).where({ REQ_TXN_ID })
          )
          console.log(`Updated TE_SR for REQ_TXN_ID ${REQ_TXN_ID}`)

          if (statusCd === Status.RSL && wfInstanceId) {
            await tx.run(
              UPDATE(MON_WF_PROCESS)
                .set({
                  WF_STATUS: 'COMPLETED',
                  UPDATED_BY: user,
                  ACTUAL_COMPLETION: now,
                })
                .where({ WF_INSTANCE_ID: wfInstanceId })
            )
            console.log(
              `Updated MON_WF_PROCESS for WF_INSTANCE_ID ${wfInstanceId}`
            )
          }
        }

        await tx.commit()
        console.log(
          `processTaskUpdate DB transaction committed for REQ_TXN_ID ${REQ_TXN_ID}`
        )
        dbResponseCode = 200
      } catch (error) {
        await tx.rollback(error)
        console.error(
          `processTaskUpdate DB transaction failed for REQ_TXN_ID ${REQ_TXN_ID}`,
          error
        )
        dbResponseCode =
          error.statusCode || error.status || (error.code && Number(error.code)) || 500

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
        return handleError(error, wfResponseCode, dbResponseCode)
      }

      return {
        status: 'success',
        'wf-response-code': wfResponseCode,
        'db-response-code': dbResponseCode,
      }
    })

    srv.on('onTaskEvent', async (req) => {
      // Trim whitespace from string fields before processing
      const data = Object.fromEntries(
        Object.entries(req.data || {}).map(([k, v]) => [
          k,
          typeof v === 'string' ? v.trim() : v,
        ])
      )
      req.data = data
      const {
        SWF_INSTANCE_ID,
        REQ_TXN_ID,
        REQUEST_TYPE: _requestType = RequestType.TE,
        TASK_TYPE,
        TASK_STATUS,
        DECISION,
        PROCESSOR,
        ASSIGNED_GROUP,
        COMPLETED_AT,
        HTTP_CALL,
      } = data

      // console.log(
      //   'onTaskEvent request payload:',
      //   JSON.stringify(req.data, null, 2)
      // )

      const correlationId = cds.utils.uuid()
      const respond = (message, status) => {
        // Always return HTTP 200 to ensure workflow engine processes the payload
        req.res.status(200)
        const payload = {
          status,
          message,
          REQ_TXN_ID: REQ_TXN_ID || '',
          correlationId,
        }
        // console.log(
        //   'onTaskEvent response payload:',
        //   JSON.stringify(payload, null, 2)
        // )
        return payload
      }
      const error = (message, status = 400) => respond(message, status)
      const success = (message, status) => respond(message, status)

      try {
        if (!SWF_INSTANCE_ID) {
          return error('Missing required field: SWF_INSTANCE_ID')
        }
        if (!REQ_TXN_ID) {
          return error('Missing required field: REQ_TXN_ID')
        }
        if (!HTTP_CALL) {
          return error('Missing required field: HTTP_CALL')
        }

        const callType = HTTP_CALL

        let task
        try {
          const response = await executeHttpRequest(
            { destinationName: 'sap_process_automation_service' },
            {
              method: 'GET',
              url: `/public/workflow/rest/v1/task-instances?workflowInstanceId=${SWF_INSTANCE_ID}`,
            }
          )
          const data = response.data || {}
          const list = Array.isArray(data.value)
            ? data.value
            : Array.isArray(data.taskInstances)
            ? data.taskInstances
            : Array.isArray(data)
            ? data
            : []
          task = list[0]
          if (!task) {
            return error('Task instance not found')
          }
        } catch (err) {
          return error(`Failed to fetch task details: ${err.message}`, 502)
        }

        const tx = cds.transaction(req)
        const now = new Date()

        if (callType === 'POST') {
          const resolvedTaskType = TASK_TYPE || task.taskDefinitionId
          const row = {
            TASK_INSTANCE_ID: task.id,
            SWF_INSTANCE_ID,
            REQ_TXN_ID,
            TASK_STATUS: task.status,
            TASK_SUBJ: task.subject,
            ASSIGNED_GROUP:
              ASSIGNED_GROUP ||
              (task.assignedGroups && task.assignedGroups[0]) ||
              (task.assignedTo && task.assignedTo[0]),
            TASK_TYPE: resolvedTaskType,
            DECISION,
            PROCESSOR,
            ACTUAL_COMPLETION: COMPLETED_AT,
            COMPLETED_DATE: COMPLETED_AT,
            CREATED_DATETIME: COMPLETED_AT,
            UPDATED_DATETIME: now,
            CREATED_BY: PROCESSOR,
            UPDATED_BY: PROCESSOR,
            language: 'EN',
          }
          try {
            await tx.run(INSERT.into(MON_WF_TASK).entries(row))
            await tx.commit()
            return success('Task record created', 201)
          } catch (err) {
            await tx.rollback(err)
            return error(`Failed to create task record: ${err.message}`)
          }
        } else if (callType === 'PATCH') {
          const id = task.id
          const resolvedTaskType = TASK_TYPE || task.taskDefinitionId
          const row = {
            DECISION,
            PROCESSOR,
            ACTUAL_COMPLETION: COMPLETED_AT || now,
            COMPLETED_DATE: COMPLETED_AT || now,
            UPDATED_BY: PROCESSOR,
            UPDATED_DATETIME: now,
            TASK_STATUS: TASK_STATUS || task.status,
            TASK_SUBJ: task.subject,
            ASSIGNED_GROUP:
              ASSIGNED_GROUP ||
              (task.assignedGroups && task.assignedGroups[0]) ||
              (task.assignedTo && task.assignedTo[0]),
          }
          try {
            await tx.run(
              UPDATE(MON_WF_TASK).set(row).where({ TASK_INSTANCE_ID: id })
            )

            const statusCd = generateReqNextStatus(
              RequestType.TE,
              resolvedTaskType,
              DECISION
            )

            const teSrUpdate = {
              STATUS_CD: statusCd,
              UPDATED_BY: PROCESSOR,
              UPDATED_DATETIME: now,
              PROCESSOR,
            }

            if (DECISION === Decision.ESLA) {
              teSrUpdate.ESCALATED_DATETIME = COMPLETED_AT || now
            }

            if (statusCd === Status.CLD) {
              teSrUpdate.CLOSED_DATETIME = COMPLETED_AT || now
            }

            await tx.run(
              UPDATE(TE_SR).set(teSrUpdate).where({ REQ_TXN_ID })
            )

            if (statusCd === Status.CLD || statusCd === Status.RSL) {
              await tx.run(
                UPDATE(MON_WF_PROCESS)
                  .set({
                    WF_STATUS: 'COMPLETED',
                    UPDATED_BY: PROCESSOR,
                    ACTUAL_COMPLETION: COMPLETED_AT || now,
                  })
                  .where({ WF_INSTANCE_ID: SWF_INSTANCE_ID })
              )
            }

            await tx.commit()
            return success('Task record updated', 200)
          } catch (err) {
            await tx.rollback(err)
            return error(`Failed to update task record: ${err.message}`)
          }
        } else {
          return error('Invalid HTTP_CALL')
        }
      } catch (err) {
        return error(err.message || 'Unexpected error', err.statusCode || 500)
      }
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

    srv.on('customComment', async (req) => {
      const { REQ_TXN_ID, TASK_TYPE, DECISION, COMMENTS, CREATED_BY } = req.data
      if (!REQ_TXN_ID || !TASK_TYPE || !DECISION || !COMMENTS) {
        return req.error(
          400,
          'REQ_TXN_ID, TASK_TYPE, DECISION and COMMENTS are required'
        )
      }
      const createdBy =
        CREATED_BY || 'nagavaraprasad.bandaru@stengg.com'
      const tx = srv.transaction(req)
      const details = deriveCommentDetails(TASK_TYPE, DECISION, createdBy)
      const row = {
        COMMENTS,
        COMMENT_EVENT: details.COMMENT_EVENT,
        COMMENT_TYPE: details.COMMENT_TYPE,
        CREATED_BY: createdBy,
        CREATED_BY_MASKED: details.CREATED_BY_MASKED,
        CREATED_DATETIME: new Date().toISOString(),
        EVENT_STATUS_CD: details.EVENT_STATUS_CD,
        REQUEST_ID: null,
        REQ_TXN_ID,
        USER_TYPE: details.USER_TYPE,
        UUID: cds.utils.uuid(),
        language: 'EN',
      }
      try {
        await tx.run(INSERT.into(CORE_COMMENTS).entries(row))
      } catch (error) {
        return req.error(500, `Failed to insert comment: ${error.message}`)
      }
      const comments = await tx.run(
        SELECT.from(CORE_COMMENTS)
          .where({ REQ_TXN_ID })
          .orderBy('CREATED_DATETIME desc')
      )
      const emails = [...new Set(comments.map((c) => c.CREATED_BY).filter(Boolean))]
      if (emails.length) {
        const users = await tx.run(
          SELECT.from(CORE_USERS)
            .columns('USER_EMAIL', 'TITLE', 'USER_FNAME')
            .where({ USER_EMAIL: { in: emails } })
        )
        const map = {}
        for (const u of users) {
          const parts = [u.TITLE, u.USER_FNAME].filter(Boolean)
          map[u.USER_EMAIL] = parts.join(' ')
        }
        comments.forEach((c) => {
          c.CREATED_BY_NAME = map[c.CREATED_BY] || ''
        })
      } else {
        comments.forEach((c) => {
          c.CREATED_BY_NAME = ''
        })
      }
      return comments
    })

    /*
    curl -X POST http://localhost:4004/rest/btp/core/custom-comment \\
      -H 'Content-Type: application/json' \\
      -d '{"REQ_TXN_ID":"<uuid>","TASK_TYPE":"TE_REQUESTER","DECISION":"APR","COMMENTS":"Hello"}'
    */

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

    srv.on('CREATE', 'CORE_COMMENTS', async (req, next) => {
      const list = Array.isArray(req.data) ? req.data : [req.data]
      try {
        await next()
      } catch (error) {
        req.error(500, `Failed to prepare CORE_COMMENTS: ${error.message}`)
        return
      }
      const tx = srv.transaction(req)
      const key = list[0] && list[0].REQ_TXN_ID
      if (!key) return []
      const comments = await tx.run(
        SELECT.from(CORE_COMMENTS)
          .where({ REQ_TXN_ID: key })
          .orderBy('CREATED_DATETIME desc')
      )
      comments.forEach((c) => {
        delete c.TASK_TYPE
        delete c.DECISION
        delete c.REQUEST_TYPE
      })
      const emails = [...new Set(comments.map((c) => c.CREATED_BY).filter(Boolean))]
      if (emails.length) {
        const users = await tx.run(
          SELECT.from(CORE_USERS)
            .columns('USER_EMAIL', 'TITLE', 'USER_FNAME')
            .where({ USER_EMAIL: { in: emails } })
        )
        const map = {}
        for (const u of users) {
          const parts = [u.TITLE, u.USER_FNAME].filter(Boolean)
          map[u.USER_EMAIL] = parts.join(' ')
        }
        comments.forEach((c) => {
          c.CREATED_BY_NAME = map[c.CREATED_BY] || null
        })
      } else {
        comments.forEach((c) => {
          c.CREATED_BY_NAME = null
        })
      }
      return comments
    })

  }

  srv.before('CREATE', 'TE_SR', async (req) => {
    const tx = cds.transaction(req)
    const user = req.user && req.user.id

    const readPayload = (field) => {
      if (!req.data) return undefined
      if (req.data[field] !== undefined) return req.data[field]
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      return req.data[camel]
    }

    const parseNameParts = (value) => {
      if (!value || typeof value !== 'string') return {}
      const trimmed = value.trim()
      if (!trimmed) return {}
      const [first, ...rest] = trimmed.split(/\s+/)
      return { first, last: rest.length ? rest.join(' ') : undefined }
    }

    const sanitize = (entry) =>
      Object.fromEntries(
        Object.entries(entry).filter(([, value]) => value !== undefined && value !== null)
      )

    const requester = {
      email: readPayload('CREATED_BY'),
      employeeId: readPayload('CREATED_BY_EMPID'),
      name: undefined,
      firstName: readPayload('CREATED_BY_FNAME'),
      lastName: readPayload('CREATED_BY_LNAME'),
      entity: readPayload('CREATED_BY_ENTITY')
    }

    if (requester.employeeId !== undefined && requester.employeeId !== null) {
      const normalizedId = String(requester.employeeId).trim()
      requester.employeeId = normalizedId || undefined
    }

    if (!requester.firstName || !requester.lastName) {
      const parts = parseNameParts(requester.name)
      if (!requester.firstName) requester.firstName = parts.first
      if (!requester.lastName) requester.lastName = parts.last
    }

    const fullName =
      (typeof requester.name === 'string' ? requester.name.trim() : '') ||
      [requester.firstName, requester.lastName].filter(Boolean).join(' ').trim()

    if (fullName) requester.name = fullName

    if (requester.email) {
      req.data.CREATED_BY = requester.email
      req.data.UPDATED_BY = requester.email
      req.data.REQUESTER_ID = requester.email
      req.data.REQ_FOR_EMAIL = requester.email
    }
    if (requester.employeeId) {
      req.data.CREATED_BY_EMPID = requester.employeeId
    }
    if (requester.name) {
      req.data.REQ_FOR_NAME = requester.name
      req.data.CREATED_BY_NAME = requester.name
    }

    if (requester.email) {
      try {
        const existing = await tx.run(
          SELECT.one.from(CORE_USERS).where({
            USER_EMAIL: requester.email,
            language: 'EN',
          })
        )
        const entry = sanitize({
          USER_EMAIL: requester.email,
          language: 'EN',
          USER_ID: requester.employeeId,
          USER_FNAME: requester.firstName || requester.name,
          USER_LNAME: requester.lastName,
          IS_ACTIVE: 'Y',
          CREATED_BY: existing?.CREATED_BY || user || requester.email,
          UPDATED_BY: user || requester.email,
        })
        console.log(
          `CORE_USERS UPSERT payload: ${JSON.stringify({ action: 'UPSERT', entry })}`
        )
        await tx.run(UPSERT.into(CORE_USERS).entries(entry))
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
      const now = new Date()
      if (!req.data.CREATED_DATETIME) req.data.CREATED_DATETIME = now
      if (!req.data.UPDATED_DATETIME) req.data.UPDATED_DATETIME = now
      if (decision === Decision.SUB) {
        const est = await calculateSLA(
          RequestType.TE,
          TaskType.TE_RESO_TEAM,
          now,
          tx
        )
        req.data.EC_DATE = est
      }
    } catch (error) {
      req.error(500, `Failed to prepare TE_SR: ${error.message}`)
    }
  })

  srv.before('PATCH', 'TE_SR', async (req) => {
    const REQ_TXN_ID =
      req.data?.REQ_TXN_ID ?? req.params?.[0]?.REQ_TXN_ID
    if (!REQ_TXN_ID) return
    req.data.REQ_TXN_ID = REQ_TXN_ID
    const now = new Date()
    if (!req.data.UPDATED_DATETIME) req.data.UPDATED_DATETIME = now
    const tx = cds.transaction(req)
      try {
        const { REQUEST_ID, DRAFT_ID, CREATED_BY_EMPID, CREATED_BY_NAME } = await tx.run(
          SELECT.one
            .from(TE_SR)
            .columns('REQUEST_ID', 'DRAFT_ID', 'CREATED_BY_EMPID', 'CREATED_BY_NAME')
            .where({ REQ_TXN_ID })
        )
      req.data.REQUEST_ID = req.data.REQUEST_ID || REQUEST_ID
      req.data.DRAFT_ID = DRAFT_ID
      if (req.data.CREATED_BY_EMPID === undefined && CREATED_BY_EMPID !== undefined) {
        req.data.CREATED_BY_EMPID = CREATED_BY_EMPID
      }
      if (req.data.CREATED_BY_NAME === undefined && CREATED_BY_NAME !== undefined) {
        req.data.CREATED_BY_NAME = CREATED_BY_NAME
      }
      if (req.data.DECISION) {
        const decisionUpper = req.data.DECISION.toUpperCase()
        if (['SUB', 'SUBMIT'].includes(decisionUpper)) {
          req.data.DECISION = Decision.SUB
        }
      }
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
      if (req.data.DECISION === Decision.SUB) {
        const est = await calculateSLA(
          RequestType.TE,
          TaskType.TE_RESO_TEAM,
          now,
          tx
        )
        req.data.EC_DATE = est
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
    console.log('TE_SR PATCH request data:', JSON.stringify(req.data))
    const REQ_TXN_ID =
      req.data?.REQ_TXN_ID ?? req.params?.[0]?.REQ_TXN_ID
    if (!REQ_TXN_ID) return
    try {
      const tx = srv.transaction(req)
      const latest = await tx.run(
        SELECT.one.from(TE_SR).where({ REQ_TXN_ID })
      )
      if (latest) {
        const payload = { ...latest, ...req.data, REQ_TXN_ID }
        await triggerWorkflow(payload, req.user && req.user.id)
        console.log(`Workflow triggered for TE_SR ${REQ_TXN_ID}`)
      }
    } catch (error) {
      console.error(
        'Workflow trigger failed:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      )
      req.reject(500, 'Technical error occured during workflow trigger')
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

  srv.before('UPDATE', 'MON_WF_TASK', async (req) => {
    const { SWF_INSTANCE_ID } = req.data

    delete req.data.TASK_INSTANCE_ID

    if (!SWF_INSTANCE_ID) return

    let tasks
    try {
      const wfSrv = await cds.connect.to('sap_process_automation_service')
      const wfSrvForUser = wfSrv.tx(req)
      const response = await wfSrvForUser.send({
        method: 'GET',
        path: `/public/workflow/rest/v1/task-instances?workflowInstanceId=${encodeURIComponent(
          SWF_INSTANCE_ID
        )}`,
      })
      tasks = response?.value || response?.data?.value || response?.data || response
    } catch (error) {
      req.error(502, `Failed to fetch task instance: ${error.message}`)
      return
    }

    const task = Array.isArray(tasks) ? tasks[0] : undefined
    if (!task) {
      req.error(
        404,
        `No task instance found for workflowInstanceId ${SWF_INSTANCE_ID}`
      )
      return
    }

  req.data.TASK_INSTANCE_ID = task.id
  req.data.TASK_STATUS = 'COMPLETED'
  req.data.COMPLETED_DATE = new Date()
  })

  srv.on('READ', 'TE_REPORT_VIEW', async (req, next) => {
    console.log('PRASAD User roles:', JSON.stringify(req.user))
    return next()
  })

  srv.before('READ', 'TE_REPORT_VIEW', async (req) => {
    // console.log('TE_REPORT_VIEW input parameters:', JSON.stringify(req.data, null, 2))
    const scimId =
      req.data['user-scim-id'] ||
      req.data.user_scim_id ||
      (req.req && req.req.query && req.req.query['user-scim-id'])
    let variant =
      req.data.VARIENT ||
      (req.req && req.req.query && req.req.query.VARIENT)
    variant = normalizeVariant(variant)
    // console.log('TE_REPORT_VIEW scimId:', scimId, 'variant:', variant)
    if (!scimId) return

    let groups = []
    let email
    try {
      const jwt = retrieveJwt(req)
      const { data } = await executeHttpRequest(
        { destinationName: 'CIS_SCIM_API', jwt },
        { method: 'GET', url: `/scim/Users/${scimId}` }
      )
      console.log('SCIM user data:', data)
      const rawGroups = (data && data.groups) || []
      groups = rawGroups
        .map((g) => (typeof g === 'string' ? g : g.display || g.value))
        .filter((g) => g && g.startsWith('STE_TE_'))
      email = (data.emails || []).find((e) => e.primary)?.value
      // console.log('TE_REPORT_VIEW groups:', groups)
      // console.log('TE_REPORT_VIEW email:', email)
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
        if (!email) {
          req.query.SELECT.where = ['1', '=', '0']
          break
        }
        append([
          '(',
          { ref: ['SR_PROCESSOR'] },
          '=',
          { val: email },
          'and',
          { ref: ['STATUS_CD'] },
          '=',
          { val: Status.RSL },
          ')'
        ])
        break
      }
      case Variant.OPEN_CASES: {
        const teamGroups = groups.filter((g) => g.startsWith('STE_TE_RESO_TEAM_'))
        if (!teamGroups.length /* && !email */) {
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
        // if (email) {
        //   if (cond.length) cond.push('or')
        //   cond.push(
        //     '(',
        //     { ref: ['TASK_PROCESSOR'] },
        //     '=',
        //     { val: email },
        //     'and',
        //     { ref: ['STATUS_CD'] },
        //     '=',
        //     { val: Status.PRT },
        //     ')'
        //   )
        // }
        append(cond)
        break
      }
      case Variant.TOTAL_CASES: {
        const isSuperAdmin = groups.some((g) => g.startsWith('STE_TE_SUPR_ADMN'))
        if (!isSuperAdmin) {
          req.query.SELECT.where = ['1', '=', '0']
        } else {
          append([{ ref: ['STATUS_CD'] }, '!=', { val: Status.DRF }])
        }
        break
      }
      case Variant.RESO_REPORT: {
        const isResoAdmin = groups.some((g) => g.startsWith('STE_TE_RESO_ADMN'))
        if (!isResoAdmin) {
          req.query.SELECT.where = ['1', '=', '0']
        } else {
          append([{ ref: ['STATUS_CD'] }, '!=', { val: Status.DRF }])
        }
        break
      }
      case Variant.SLA_BREACH_CASES: {
        const leadGroups = groups.filter((g) => g.startsWith('STE_TE_RESO_LEAD_'))
        if (!leadGroups.length /* && !email */) {
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
        // if (email) {
        //   if (cond.length) cond.push('or')
        //   cond.push(
        //     '(',
        //     { ref: ['TASK_PROCESSOR'] },
        //     '=',
        //     { val: email },
        //     'and',
        //     { ref: ['STATUS_CD'] },
        //     '=',
        //     { val: Status.PRL },
        //     ')'
        //   )
        // }
        append(cond)
        break
      }
      default:
        // If no variant matches, leave the query untouched
        break
    }

    // console.log(
    //   'TE_REPORT_VIEW query before execution:',
    //   JSON.stringify(req.query, null, 2)
    // )
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
          const comments = await db.run(
            SELECT.from(CORE_COMMENTS)
              .where({ REQ_TXN_ID: key })
              .orderBy('CREATED_DATETIME desc')
          )
          const emails = [
            ...new Set(comments.map((c) => c.CREATED_BY).filter(Boolean)),
          ]
          if (emails.length) {
            const users = await db.run(
              SELECT.from(CORE_USERS)
                .columns('USER_EMAIL', 'TITLE', 'USER_FNAME')
                .where({ USER_EMAIL: { in: emails } })
            )
            const map = {}
            for (const u of users) {
              const parts = [u.TITLE, u.USER_FNAME].filter(Boolean)
              map[u.USER_EMAIL] = parts.join(' ')
            }
            comments.forEach((c) => {
              c.CREATED_BY_NAME = map[c.CREATED_BY] || null
            })
          } else {
            comments.forEach((c) => {
              c.CREATED_BY_NAME = null
            })
          }
          item.CORE_COMMENTS = comments
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
          item.MON_WF_PROCESS = await db.run(
            SELECT.from(MON_WF_PROCESS).where({ REQ_TXN_ID: key })
          )
        } catch (error) {
          req.warn(
            `Error fetching MON_WF_PROCESS for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.MON_WF_PROCESS = []
        }
        try {
          item.MON_WF_TASK = await db.run(
            SELECT.from(MON_WF_TASK)
              .where({ REQ_TXN_ID: key })
              .orderBy('CREATED_DATETIME desc')
          )
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
    srv.on('calculateSLA', async (req) => {
      const { taskType, projectType, createdAt } = req.data
      try {
        const est = await calculateSLA(taskType, projectType, createdAt, srv.transaction(req))
        return { estimatedCompletionDate: est }
      } catch (error) {
        req.error(400, error.message)
      }
    })

    srv.on('userInfo', async (req) => {
      console.log('PRASAD', JSON.stringify(req));
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
