const {
  CommentType,
  CommentEvent,
  UserType,
  EventStatus,
  TaskType,
  Decision,
} = require('../utils/enums');

function enrichCoreComment(payload = {}) {
  const taskType =
    typeof payload.TASK_TYPE === 'string'
      ? payload.TASK_TYPE.trim().toUpperCase()
      : payload.TASK_TYPE;
  const decision =
    typeof payload.DECISION === 'string'
      ? payload.DECISION.trim().toLowerCase()
      : payload.DECISION;

  const enriched = {
    ...payload,
    TASK_TYPE: taskType,
    DECISION: decision,
  };

  if (taskType === TaskType.TE_REQUESTER) {
    enriched.USER_TYPE = UserType.TE_REQUESTER;
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_CREATED;
    enriched.EVENT_STATUS_CD = EventStatus.IN_PROGRESS;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.APR.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_TEAM;
    enriched.COMMENT_TYPE = CommentType.MILESTONE;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED;
    enriched.EVENT_STATUS_CD = EventStatus.COMPLETED;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.REJ.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_TEAM;
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION;
    enriched.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  } else if (taskType === TaskType.TE_RESO_TEAM && decision === Decision.ESL.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_TEAM;
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_ESCALATED;
    enriched.EVENT_STATUS_CD = EventStatus.IN_PROGRESS;
  } else if (taskType === TaskType.TE_AUTO_ESLA && decision === Decision.ESLA.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_TEAM;
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_AUTO_ESCALATED;
    enriched.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.APR.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_LEAD;
    enriched.COMMENT_TYPE = CommentType.MILESTONE;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_RESOLVED;
    enriched.EVENT_STATUS_CD = EventStatus.COMPLETED;
  } else if (taskType === TaskType.TE_RESO_LEAD && decision === Decision.REJ.toLowerCase()) {
    enriched.USER_TYPE = UserType.RESOLUTION_LEAD;
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = CommentEvent.SERVICE_REQUEST_NEED_CLARIFICATION;
    enriched.EVENT_STATUS_CD = EventStatus.ON_HOLD;
  } else {
    enriched.USER_TYPE = 'No Task Type Provided';
    enriched.COMMENT_TYPE = CommentType.DOCUMENT;
    enriched.COMMENT_EVENT = 'Error Event';
    enriched.EVENT_STATUS_CD = 'Error';
  }

  return enriched;
}

module.exports = enrichCoreComment;
