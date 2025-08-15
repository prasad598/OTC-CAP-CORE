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

async function postComment(comment, transactionId, createdBy, taskType, decision, tx = cds.db) {
  const { REQUEST_ID } = await tx.run(
    SELECT.one.from('BTP.TE_SR').columns('REQUEST_ID').where({ REQ_TXN_ID: transactionId })
  ) || {};

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
  } else {
    return payload;
  }

  await tx.run(INSERT.into('BTP.CORE_COMMENTS').entries(payload));
  return payload;
}

module.exports = { postComment };
