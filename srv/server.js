const cds = require('@sap/cds')
const { SELECT, INSERT } = cds.ql || cds
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')
const { json } = require('express')
const { sendEmail } = require('./utils/mail')

cds.on('bootstrap', (app) => {
  const mappings = {
    '/rest/btp/core/attachments': '/rest/btp/core/CORE_ATTACHMENTS',
    '/rest/btp/core/comments': '/rest/btp/core/CORE_COMMENTS',
    '/rest/btp/core/workflow-process': '/rest/btp/core/MON_WF_PROCESS',
    '/rest/btp/core/workflow-task': '/rest/btp/core/MON_WF_TASK',
    '/rest/btp/core/te-servicerequest': '/rest/btp/core/TE_SR',
    '/rest/btp/core/users': '/rest/btp/core/CORE_USERS',
    '/rest/btp/core/user-info': '/rest/btp/core/userInfo()',
    '/rest/btp/core/auth-matrix': '/rest/btp/core/AUTH_MATRIX',
  }
  for (const [alias, target] of Object.entries(mappings)) {
    app.use(alias, json(), (req, res) => {
      let suffix = req.originalUrl.slice(alias.length)
      if (
        alias === '/rest/btp/core/te-servicerequest' &&
        req.method === 'PATCH' &&
        (!suffix || suffix === '/') &&
        req.body?.REQ_TXN_ID
      ) {
        suffix = `(REQ_TXN_ID=${encodeURIComponent(req.body.REQ_TXN_ID)})`
      } else if (
        alias === '/rest/btp/core/workflow-task' &&
        req.method === 'PATCH' &&
        (!suffix || suffix === '/') &&
        req.body?.TASK_INSTANCE_ID
      ) {
        suffix = `(TASK_INSTANCE_ID=${encodeURIComponent(req.body.TASK_INSTANCE_ID)})`
      }
      res.redirect(307, target + suffix)
    })
  }

  app.post('/rest/btp/core/sendReport', json(), async (req, res) => {
    try {
      let ExcelJS
      try {
        ExcelJS = require('exceljs')
      } catch (err) {
        res
          .status(500)
          .json({ error: { message: 'Excel generation module missing' } })
        return
      }

      const {
        TO_EMAILS,
        CC_EMAILS,
        CASE_ID,
        SRV_CAT_CD,
        REPORT_NO,
        STATUS_CD,
        ENTITY_CD,
        CREATED_BY,
        CREATED_BY_EMPID,
        CREATED_BY_NAME,
        SR_PROCESSOR,
        SR_PROCESSOR_ID,
        SR_PROCESSOR_NAME,
        TASK_PROCESSOR,
        ASSIGNED_GROUP,
        CREATED_DATETIME,
        EC_DATE,
        IS_CLAR_REQ_DATETIME,
        ESCALATED_DATETIME,
        RESOLVED_DATETIME,
        CLOSED_DATETIME,
      } = req.body || {}

      const { TE_REPORT_VIEW } = cds.entities('ReportService')
      let query = SELECT.from(TE_REPORT_VIEW)
      let has = false
      const add = (field, value, op = '=') => {
        if (value === undefined || value === null || value === '') return
        if (!has) {
          query.where(field, op, value)
          has = true
        } else {
          query.and(field, op, value)
        }
      }
      const simple = {
        CASE_ID,
        SRV_CAT_CD,
        REPORT_NO,
        STATUS_CD,
        ENTITY_CD,
        CREATED_BY,
        CREATED_BY_EMPID,
        CREATED_BY_NAME,
        SR_PROCESSOR,
        SR_PROCESSOR_ID,
        SR_PROCESSOR_NAME,
        TASK_PROCESSOR,
        ASSIGNED_GROUP,
      }
      for (const [f, v] of Object.entries(simple)) add(f, v)
      const ranges = {
        CREATED_DATETIME,
        EC_DATE,
        IS_CLAR_REQ_DATETIME,
        ESCALATED_DATETIME,
        RESOLVED_DATETIME,
        CLOSED_DATETIME,
      }
      for (const [f, r] of Object.entries(ranges)) {
        if (r?.from) add(f, r.from, '>=')
        if (r?.to) add(f, r.to, '<=')
      }

      const data = await cds.run(query)

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Report')
      if (data.length) {
        worksheet.columns = Object.keys(data[0]).map((k) => ({
          header: k,
          key: k,
        }))
        worksheet.addRows(data)
      }
      const buffer = await workbook.xlsx.writeBuffer()

      const userEmail = req.user?.id
      const to = (TO_EMAILS ? TO_EMAILS.split(',') : []).map((e) => e.trim())
      if (userEmail && !to.includes(userEmail)) to.push(userEmail)
      const cc = (CC_EMAILS ? CC_EMAILS.split(',') : []).map((e) => e.trim())

      const mailResponse = await sendEmail(
        'TE Report',
        to,
        cc,
        'Generated report attached.',
        [{ fileName: 'report.xlsx', content: buffer.toString('base64') }]
      )

      res.json({ status: 'success', count: data.length, mailResponse })
    } catch (err) {
      res.status(500).json({ error: { message: err.message } })
    }
  })

  app.get('/rest/btp/scim/Users/:id', async (req, res, next) => {
    try {
      const jwt = retrieveJwt(req)
      if (!jwt) {
        res.status(401).json({ error: { message: 'Missing JWT' } })
        return
      }
      const { data } = await executeHttpRequest(
        { destinationName: 'CIS_SCIM_API', jwt },
        { method: 'GET', url: `/scim/Users/${req.params.id}` }
      )
      const primaryEmail = data.emails?.find((e) => e.primary)?.value
      const workPhone = data.phoneNumbers?.find(
        (p) => p.primary && p.type === 'work'
      )?.value
      const enterprise =
        data['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] || {}
      const givenName = data.name?.givenName
      const familyName = data.name?.familyName
      const payload = {
        id: data.id,
        fullName: [givenName, familyName].filter(Boolean).join(' '),
        honorificPrefix: data.name?.honorificPrefix,
        email: primaryEmail,
        entity: enterprise.organization,
        employeeId: enterprise.employeeNumber,
        mobile: workPhone,
        dbagba: enterprise.division,
        groups: (data.groups || []).map((g) => g.display),
      }

      const { CORE_USERS } = cds.entities('BTP')
      if (primaryEmail && cds.db) {
        const existing = await cds.db.run(
          SELECT.one.from(CORE_USERS).where({ USER_EMAIL: primaryEmail })
        )
        if (!existing) {
          await cds.db.run(
            INSERT.into(CORE_USERS).entries({
              USER_EMAIL: primaryEmail,
              USER_ID: enterprise.employeeNumber,
              USER_HP: workPhone,
              TITLE: data.name?.honorificPrefix,
              USER_FNAME: givenName,
              USER_LNAME: familyName,
              IS_ACTIVE: data.active ? 'Y' : 'N',
            })
          )
        }
      }

      res.json(payload)
    } catch (err) {
      next(err)
    }
  })

  app.use((err, req, res, _next) => {
    const status = err.statusCode || err.status || 500
    const message = err.cause?.message || err.message || 'Unexpected error'
    res.status(status).json({ error: { message } })
  })
})

module.exports = cds.server
