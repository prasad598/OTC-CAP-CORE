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

module.exports = { Decision, TaskType, RequestType, Status };
