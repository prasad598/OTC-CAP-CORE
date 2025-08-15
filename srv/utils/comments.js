const cds = require('@sap/cds');
const { SELECT, INSERT } = cds.ql;
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

async function postComment(
  comment,
  transactionId,
  createdBy,
  taskType,
  decision,
  tx = cds.db,
  extra = {}
) {
  const teSrEntity = resolveEntity(tx, 'TE_SR')
  const coreCommentsEntity = resolveEntity(tx, 'CORE_COMMENTS')

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
    REQUEST_ID,
    COMMENTS: comment,
    CREATED_BY: createdBy,
    language: 'EN'
  };

  if (taskType === TaskType.TE_REQUESTER) {
    payload.USER_TYPE = UserType.TE_REQUESTER;
    payload.COMMENT_TYPE = CommentType.DOCUMENT;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_CREATED;
    payload.EVENT_STATUS_CD = EventStatus.IN_PROGRESS;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.APR) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM;
    payload.COMMENT_TYPE = CommentType.MILESTONE;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED;
    payload.EVENT_STATUS_CD = EventStatus.COMPLETED;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.REJ) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM;
    payload.COMMENT_TYPE = CommentType.DOCUMENT;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION;
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.ESL) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM;
    payload.COMMENT_TYPE = CommentType.DOCUMENT;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_ESCALATED;
    payload.EVENT_STATUS_CD = EventStatus.IN_PROGRESS;
  } else if (taskType === TaskType.TE_AUTO_ESLA && decision === Decision.ESLA) {
    payload.USER_TYPE = UserType.RESOLUTION_TEAM;
    payload.COMMENT_TYPE = CommentType.DOCUMENT;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_AUTO_ESCALATED;
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.APR) {
    payload.USER_TYPE = UserType.RESOLUTION_LEAD;
    payload.COMMENT_TYPE = CommentType.MILESTONE;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED;
    payload.EVENT_STATUS_CD = EventStatus.COMPLETED;
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.REJ) {
    payload.USER_TYPE = UserType.RESOLUTION_LEAD;
    payload.COMMENT_TYPE = CommentType.DOCUMENT;
    payload.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION;
    payload.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  }

  const sanitizedExtra = Object.fromEntries(
    Object.entries(extra).filter(([, v]) => v !== undefined)
  )
  Object.assign(payload, sanitizedExtra)
  await tx.run(INSERT.into(coreCommentsEntity).entries(payload));
  return payload;
}

module.exports = { postComment };
