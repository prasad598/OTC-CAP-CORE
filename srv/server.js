const cds = require('@sap/cds')
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')
const { json } = require('express')
const { sendEmail } = require('./utils/mail')
const { buildExcel } = require('./utils/excel')
const { TE_SR_COLUMNS } = require('./utils/teSrColumns')
const { fetchIasUser } = require('./utils/ias')
const { SELECT } = cds.ql

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
      }
      res.redirect(307, target + suffix)
    })
  }

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
      res.json({
        id: data.id,
        fullName: [data.name?.givenName, data.name?.familyName]
          .filter(Boolean)
          .join(' '),
        honorificPrefix: data.name?.honorificPrefix,
        email: primaryEmail,
        entity: enterprise.organization,
        employeeId: enterprise.employeeNumber,
        mobile: workPhone,
        groups: (data.groups || []).map((g) => g.display),
      })
    } catch (err) {
      next(err)
    }
  })

    app.post('/rest/btp/te/emailCaseList', json(), async (req, res, next) => {
      try {
        const { filter = {} } = req.body || {}
        const reportSrv = await cds.connect.to('ReportService')
        const { TE_REPORT_VIEW } = reportSrv.entities
        const conditions = []
        if (filter.SRV_CAT_CD)
          conditions.push({ SERVICE_CATEGORY_CODE: filter.SRV_CAT_CD })
        if (filter.STATUS_CD)
          conditions.push({ STATUS_CODE: filter.STATUS_CD })
        if (filter.ENTITY_CD)
          conditions.push({ ENTITY_CODE: filter.ENTITY_CD })
        if (filter.ASSIGNED_GROUP)
          conditions.push({ ASSIGNED_GROUP: filter.ASSIGNED_GROUP })
        if (filter.CREATED_BY)
          conditions.push({ CREATED_BY: filter.CREATED_BY })
        if (filter.CREATION_DATE1 && filter.CREATION_DATE2) {
          conditions.push({
            CREATION_DATE: {
              between: [filter.CREATION_DATE1, filter.CREATION_DATE2],
            },
          })
        } else if (filter.CREATION_DATE1) {
          conditions.push({ CREATION_DATE: { '>=': filter.CREATION_DATE1 } })
        } else if (filter.CREATION_DATE2) {
          conditions.push({ CREATION_DATE: { '<=': filter.CREATION_DATE2 } })
        }
        const query = SELECT.from(TE_REPORT_VIEW)
        if (conditions.length) query.where(conditions)
        const rows = await reportSrv.run(query)
        const buffer = buildExcel(rows, TE_SR_COLUMNS)
        const user = await fetchIasUser(req)
        const to =
          user.emails?.find((e) => e.primary)?.value || user.emails?.[0]?.value
        await sendEmail(
          'TE Case List',
          to,
          null,
          'Please find attached TE case list.',
          [
            {
              filename: 'case-list.xls',
              content: buffer.toString('base64'),
              'content-type': 'application/vnd.ms-excel',
            },
          ]
        )
        res.json({ status: 'sent', rows: rows.length })
      } catch (err) {
        next(err)
      }
    })

    app.get(
      '/rest/btp/core/TE_SR/9af63951-2772-4174-80fa-b7661faafbf7',
      (req, res) => {
        res.json(TE_SR_COLUMNS)
      }
    )

  app.use((err, req, res, _next) => {
    const status = err.statusCode || err.status || 500
    const message = err.cause?.message || err.message || 'Unexpected error'
    res.status(status).json({ error: { message } })
  })
})

module.exports = cds.server
