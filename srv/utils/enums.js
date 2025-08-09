const Decision = Object.freeze({
  DRF: 'Draft',
  SUB: 'submit',
  RSB: 'submit',
  APR: 'approved',
  REJ: 'reject',
  ESL: 'escalated'
});

const TaskType = Object.freeze({
  TE_REQUESTER: 'TE_REQUESTER',
  TE_RESO_TEAM: 'TE_RESO_TEAM',
  TE_RESO_LEAD: 'TE_RESO_LEAD'
});

const RequestType = Object.freeze({
  TE: 'TE',
  PTP: 'PTP'
});

const Status = Object.freeze({
  DRF: 'Draft',
  SUB: 'Submit',
  RSB: 'Resubmit',
  PRT: 'Pending Resolution Team',
  PRL: 'Pending Resolution Lead',
  CLR: 'Clarification Required',
  RSL: 'Resolved',
  CLD: 'Closed',
  ERR: 'Error'
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
