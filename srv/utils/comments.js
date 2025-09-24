const cds = require('@sap/cds')
const { SELECT, INSERT } = cds.ql
const {
  CommentType,
  CommentEvent,
  UserType,
  EventStatus,
  TaskType,
  Decision,
} = require('./enums');

function normalizeEnum(enumObj, value) {
  if (typeof value !== 'string') return value
  const key = value
    .trim()
    // convert camelCase to snake_case then to upper case
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toUpperCase()
  if (enumObj[key]) return enumObj[key]
  const val = value.trim().toUpperCase()
  const match = Object.values(enumObj).find(
    (v) => v.toUpperCase() === val
  )
  return match || value.trim()
}

function resolveEntity(tx, name) {
  const defs = tx.model?.definitions || {}
  // If there is any definition ending with the entity name that is not
  // prefixed by the database namespace, the caller is a service transaction
  // and expects unqualified entity names. Otherwise, fall back to the fully
  // qualified name used by cds.db.
  const hasServiceDef = Object.keys(defs).some(
    (d) => d.endsWith(`.${name}`) && !d.startsWith('BTP.')
  )
  return hasServiceDef ? name : `BTP.${name}`
}

function deriveCommentDetails(taskType, decision, createdBy) {
  const result = {
    COMMENT_EVENT: '',
    COMMENT_TYPE: '',
    EVENT_STATUS_CD: '',
    USER_TYPE: UserType.REQUESTER,
    CREATED_BY_MASKED: createdBy,
  }

  if (taskType) {
    taskType = normalizeEnum(TaskType, taskType)
  }

  if (decision) {
    decision = normalizeEnum(Decision, decision)
  }

  if (taskType === TaskType.TE_REQUESTER) {
    result.USER_TYPE = UserType.REQUESTER
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.APR) {
    result.USER_TYPE = UserType.RESOLUTION_TEAM
    result.COMMENT_TYPE = CommentType.MILESTONE
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED
    result.EVENT_STATUS_CD = EventStatus.COMPLETED
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.REJ) {
    result.USER_TYPE = UserType.RESOLUTION_TEAM
    result.COMMENT_TYPE = CommentType.DOCUMENT
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION
    result.EVENT_STATUS_CD = EventStatus.ON_HOLD
  } else if (
    taskType === TaskType.TE_RESO_TEAM &&
    (decision === Decision.ESL || decision === Decision.ESLA)
  ) {
    result.USER_TYPE = UserType.RESOLUTION_TEAM
    result.COMMENT_TYPE = CommentType.DOCUMENT
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_ESCALATED
    result.EVENT_STATUS_CD = EventStatus.IN_PROGRESS
  } else if (
    taskType === TaskType.TE_AUTO_ESLA &&
    (decision === Decision.ESLA || decision === Decision.ESL)
  ) {
    result.USER_TYPE = UserType.RESOLUTION_TEAM
    result.COMMENT_TYPE = CommentType.DOCUMENT
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_AUTO_ESCALATED
    result.EVENT_STATUS_CD = EventStatus.ON_HOLD
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.APR) {
    result.USER_TYPE = UserType.RESOLUTION_LEAD
    result.COMMENT_TYPE = CommentType.MILESTONE
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED
    result.EVENT_STATUS_CD = EventStatus.COMPLETED
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.REJ) {
    result.USER_TYPE = UserType.RESOLUTION_LEAD
    result.COMMENT_TYPE = CommentType.DOCUMENT
    result.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION
    result.EVENT_STATUS_CD = EventStatus.ON_HOLD
  }

  return result
}

async function buildCommentPayload(
  comment,
  transactionId,
  createdBy,
  taskType,
  decision,
  tx = cds.db,
  extra = {}
) {
  const teSrEntity = resolveEntity(tx, 'TE_SR')

  let { REQUEST_ID, REQUEST_TYPE: _REQUEST_TYPE, ...rest } = extra
  if (!REQUEST_ID) {
    ;({ REQUEST_ID } =
      (await tx.run(
        SELECT.one
          .from(teSrEntity)
          .columns('REQUEST_ID')
          .where({ REQ_TXN_ID: transactionId })
      )) || {})
  }
  
  const payload = {
    REQ_TXN_ID: transactionId,
    REQUEST_ID: REQUEST_ID || null,
    COMMENTS: comment,
    CREATED_BY: createdBy,
    language: 'EN',
  }

  // merge any additional fields provided by the caller without
  // overwriting existing defaults with undefined values
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) payload[key] = value
  }
  Object.assign(
    payload,
    deriveCommentDetails(taskType, decision, createdBy)
  )

  return payload
}
async function postComment(
  comment,
  transactionId,
  createdBy,
  taskType,
  decision,
  tx = cds.db,
  extra = {},
) {
  const entity = resolveEntity(tx, 'CORE_COMMENTS')
  const payload = await buildCommentPayload(
    comment,
    transactionId,
    createdBy,
    taskType,
    decision,
    tx,
    extra
  )
  await tx.run(INSERT.into(entity).entries(payload))
  return payload
}

module.exports = {
  buildCommentPayload,
  postComment,
  deriveCommentDetails,
}
