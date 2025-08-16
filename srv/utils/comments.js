const cds = require('@sap/cds')
const { SELECT } = cds.ql
const {
  CommentType,
  CommentEvent,
  UserType,
  EventStatus,
  TaskType,
  Decision
} = require('./enums');

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

  let { REQUEST_ID } = extra
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
    CREATED_BY_MASKED: createdBy,
    language: 'EN',
    USER_TYPE: null,
    COMMENT_TYPE: null,
    COMMENT_EVENT: null,
    EVENT_STATUS_CD: null,
  }

  // allow selected additional fields from the request payload
  if (extra.UUID !== undefined) payload.UUID = extra.UUID
  if (extra.language !== undefined) payload.language = extra.language
  if (extra.REQUEST_ID !== undefined) payload.REQUEST_ID = extra.REQUEST_ID
  if (extra.CREATED_BY_MASKED !== undefined) payload.CREATED_BY_MASKED = extra.CREATED_BY_MASKED

  if (decision && !Object.values(Decision).includes(decision)) {
    decision = Decision[decision] || decision
  }

  if (taskType === TaskType.TE_REQUESTER) {
    payload.USER_TYPE = UserType.TE_REQUESTER
    payload.COMMENT_TYPE = CommentType.DOCUMENT
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_CREATED
    payload.EVENT_STATUS_CD = EventStatus.IN_PROGRESS
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.APR) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM
    payload.COMMENT_TYPE = CommentType.MILESTONE
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED
    payload.EVENT_STATUS_CD = EventStatus.COMPLETED
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.REJ) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM
    payload.COMMENT_TYPE = CommentType.DOCUMENT
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.ESL) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM
    payload.COMMENT_TYPE = CommentType.DOCUMENT
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_ESCALATED
    payload.EVENT_STATUS_CD = EventStatus.IN_PROGRESS
  } else if (taskType === TaskType.TE_AUTO_ESLA && decision === Decision.ESLA) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM
    payload.COMMENT_TYPE = CommentType.DOCUMENT
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_AUTO_ESCALATED
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.APR) {
    payload.USER_TYPE = UserType.RESOLUTION_LEAD
    payload.COMMENT_TYPE = CommentType.MILESTONE
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED
    payload.EVENT_STATUS_CD = EventStatus.COMPLETED
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.REJ) {
    payload.USER_TYPE = UserType.RESOLUTION_LEAD
    payload.COMMENT_TYPE = CommentType.DOCUMENT
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD
  }

  return payload
}
module.exports = { buildCommentPayload }
