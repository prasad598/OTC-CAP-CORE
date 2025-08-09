const { executeHttpRequest } = require('@sap-cloud-sdk/http-client')

async function fetchIasUser(req) {
  const userUuid = req?.user?.attr?.user_uuid || req?.user?.id
  if (!userUuid) {
    throw new Error('Missing user UUID')
  }
  const response = await executeHttpRequest(
    { destinationName: 'CIS_SCIM_API' },
    {
      method: 'GET',
      url: `/scim/Users/${userUuid}`,
    }
  )
  return response.data || {}
}

module.exports = { fetchIasUser }
