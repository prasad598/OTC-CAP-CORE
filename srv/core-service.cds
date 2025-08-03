using BTP as core from '../db/schema';

service UserService {
  entity CORE_USERS as projection on core.CORE_USERS;
}

service RestService @(path: '/rest/btp/core', protocol: 'rest') {
  entity CORE_ATTACHMENTS @(path: 'attachments') as projection on core.CORE_ATTACHMENTS;

  entity CORE_COMMENTS @(path: 'comments') as projection on core.CORE_COMMENTS;

  entity MON_WF_PROCESS @(path: 'workflow-process') as projection on core.MON_WF_PROCESS;

  entity MON_WF_TASK @(path: 'workflow-task') as projection on core.MON_WF_TASK;

  entity TE_SR @(path: 'te-servicerequest') as projection on core.TE_SR;

  action processTaskUpdate(
    REQ_TXN_ID       : UUID,
    TASK_INSTANCE_ID : String,
    TASK_TYPE        : String,
    DECISION         : String,
    CASE_BCG         : String,
    SRC_PROB_CD      : String
  ) returns {
    status : String;
  };
}
