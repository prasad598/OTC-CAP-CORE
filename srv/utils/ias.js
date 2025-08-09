const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')
const { retrieveJwt } = require('@sap-cloud-sdk/connectivity')

async function fetchIasUser(req) {
  const userUuid = req?.user?.attr?.user_uuid || req?.user?.id
  if (!userUuid) {
    throw new Error('Missing user UUID')
  }
  const jwt = retrieveJwt(req)
  const response = await executeHttpRequest(
    { destinationName: 'CIS_SCIM_API', jwt },
    {
      method: 'GET',
      url: `/scim/Users/${userUuid}`,
    }
  )
  return response.data || {}
}

module.exports = { fetchIasUser }
