const Decision = Object.freeze({
  DRF: 'draft',
  SUB: 'submit',
  RSB: 'submit',
  APR: 'approve',
  REJ: 'reject',
  ESL: 'Escalate'
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
  DRF: 'DRF',
  SUB: 'SUB',
  RSB: 'RSB',
  PRT: 'PRT',
  PRL: 'PRL',
  CLR: 'CLR',
  RSL: 'RSL',
  CLD: 'CLD',
  ERR: 'ERR'
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

const Variant = Object.freeze({
  MY_CASES: 'MY_CASES',
  CLOSED_CASES: 'CLOSED_CASES',
  OPEN_CASES: 'OPEN_CASES',
  TOTAL_CASES: 'TOTAL_CASES',
  SLA_BREACH_CASES: 'SLA_BREACH_CASES'
});

module.exports = {
  Decision,
  TaskType,
  RequestType,
  Status,
  UserType,
  CommentType,
  CommentEvent,
  EventStatus,
  Variant
};
