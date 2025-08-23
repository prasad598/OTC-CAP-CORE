const Decision = Object.freeze({
  DRF: 'draft',
  SUB: 'submit',
  RSB: 'submit',
  APR: 'approve',
  REJ: 'reject',
  ESL: 'Escalate',
  ESLA: 'ESLA',
  CLDA: 'CLDA',
  NA: 'NA'
});

const TaskType = Object.freeze({
  TE_REQUESTER: 'TE_REQUESTER',
  TE_RESO_TEAM: 'TE_RESO_TEAM',
  TE_RESO_LEAD: 'TE_RESO_LEAD',
  TE_AUTO_ESLA: 'TE_AUTO_ESLA'
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
  PRC: 'PRC',
  CLR: 'CLR',
  RSL: 'RSL',
  CLD: 'CLD',
  ERR: 'ERR',
  ESLA: 'ESLA',
  CLDA: 'CLDA'
});

const UserType = Object.freeze({
  REQUESTER: 'Requester',
  TE_REQUESTER: 'TE Requester',
  RESOLUTION_TEAM: 'Resolution Team',
  RESOLUTION_LEAD: 'Resolution Lead'
});

const CommentType = Object.freeze({
  DOCUMENT: 'document',
  MILESTONE: 'milestone'
});

const CommentEvent = Object.freeze({
  SERVICE_REQUEST_CREATED: 'Service Request Created',
  SERVICE_REQUEST_RESOLVED: 'Service Request Resolved',
  SERVICE_REQUEST_NEED_CLARIFICATION: 'Service Request need clarification',
  SERVICE_REQUEST_AUTO_CLOSED: 'Service Request Auto Closed',
  SERVICE_REQUEST_ESCALATED: 'Service Request Escalated',
  SERVICE_REQUEST_AUTO_ESCALATED: 'Service Request Auto Escalated'
});

const EventStatus = Object.freeze({
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold'
});

const Variant = Object.freeze({
  MY_CASES: 'MY_CASES',
  CLOSED_CASES: 'CLOSED_CASES',
  OPEN_CASES: 'OPEN_CASES',
  TOTAL_CASES: 'TOTAL_CASES',
  SLA_BREACH_CASES: 'SLA_BREACH_CASES',
  STE_TE_RESO_ADMN: 'STE_TE_RESO_ADMN'
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
