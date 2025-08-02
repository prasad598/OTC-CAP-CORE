using BTP as core from '../db/schema';

service UserService {
  entity CORE_USERS as projection on core.CORE_USERS;
}

service RestService @(path: '/rest/btp/core', protocol: 'rest') {
  @path: 'attachments'
  entity CORE_ATTACHMENTS as projection on core.CORE_ATTACHMENTS;

  @path: 'comments'
  entity CORE_COMMENTS as projection on core.CORE_COMMENTS;

  @path: 'workflow-process'
  entity MON_WF_PROCESS as projection on core.MON_WF_PROCESS;

  @path: 'workflow-task'
  entity MON_WF_TASK as projection on core.MON_WF_TASK;

  @path: 'te-servicerequest'
  entity TE_SR as projection on core.TE_SR;
}
