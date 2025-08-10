const cds = require('@sap/cds')
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')

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
    app.use(alias, (req, res) => {
      res.redirect(307, target + req.originalUrl.slice(alias.length))
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

  app.use((err, req, res, _next) => {
    const status = err.statusCode || err.status || 500
    const message = err.cause?.message || err.message || 'Unexpected error'
    res.status(status).json({ error: { message } })
  })
})

module.exports = cds.server
