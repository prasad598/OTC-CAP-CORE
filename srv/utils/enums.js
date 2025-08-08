const Decision = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMIT: 'SUBMIT',
  'RE-SUBMIT': 'RE-SUBMIT',
  APPROVED: 'APPROVED',
  REJECT: 'REJECT',
  ESCALATED: 'ESCALATED'
});

const TaskType = Object.freeze({
  TE_REQUESTER: 'TE_REQUESTER',
  TE_RESO: 'TE_RESO',
  TE_RESO_LEAD: 'TE_RESO_LEAD'
});

const RequestType = Object.freeze({
  TE: 'TE',
  PTP: 'PTP'
});

const Status = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMIT: 'SUBMIT',
  'RE-SUBMIT': 'RE-SUBMIT',
  PR: 'PR',
  PRL: 'PRL',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ERROR: 'ERROR'
});

const UserType = Object.freeze({});

const CommentType = Object.freeze({
  DOCUMENT: 'document',
  MILESTONE: 'milestone'
});

const CommentEvent = Object.freeze({
  SERVICE_REQUEST_CREATED: 'Service Request Created'
});

const EventStatus = Object.freeze({});

module.exports = {
  Decision,
  TaskType,
  RequestType,
  Status,
  UserType,
  CommentType,
  CommentEvent,
  EventStatus
};
