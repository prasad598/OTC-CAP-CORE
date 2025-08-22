using BTP as core from '../db/schema';
using { commonTypes } from '../db/commonTypes';

type ScimGroup {
  value  : String;
  display: String;
};

type ScimEmail {
  value   : String;
  primary : Boolean;
};

type LoggedUserInfo {
  id          : String;
  userName    : String;
  displayName : String;
  emails      : array of ScimEmail;
  groups      : array of ScimGroup;
};

service RestService @(path: '/rest/btp/core', protocol: 'rest') {
  entity CORE_ATTACHMENTS @(path: 'attachments') as projection on core.CORE_ATTACHMENTS;

  entity CORE_COMMENTS @(path: 'comments') as projection on core.CORE_COMMENTS {
    *,
    virtual TASK_TYPE : String,
    virtual DECISION  : String,
    virtual CREATED_BY_NAME : String
  };
  entity CORE_USERS @(path: 'users') as projection on core.CORE_USERS;

  entity AUTH_MATRIX @(path: 'auth-matrix') as projection on core.AUTH_MATRIX;

  entity CONFIG_LDATA @(path: 'config-ldata') as projection on core.CONFIG_LDATA;

  entity MON_WF_PROCESS @(path: 'workflow-process') as projection on core.MON_WF_PROCESS;

  entity MON_WF_TASK @(path: 'workflow-task') as projection on core.MON_WF_TASK;

  entity TE_SR @(path: 'te-servicerequest') as projection on core.TE_SR;

  action processTaskUpdate(
    REQ_TXN_ID       : UUID,
    TASK_INSTANCE_ID : String,
    TASK_TYPE        : String,
    DECISION         : String,
    CASE_BCG_CD      : commonTypes.lookupCode,
    SRC_PROB_CD      : String,
    UPDATED_BY       : commonTypes.emailId
  ) returns {
    status : String;
  };

  action onTaskEvent(
    SWF_INSTANCE_ID : commonTypes.uuidv4,
    REQ_TXN_ID      : commonTypes.uuidv4,
    TASK_TYPE       : commonTypes.taskType?,
    TASK_STATUS     : commonTypes.statusSBPA?,
    DECISION        : commonTypes.decision?,
    PROCESSOR       : commonTypes.emailId?,
    ASSIGNED_GROUP  : commonTypes.iasGroup?,
    COMPLETED_AT    : commonTypes.dateTime?,
    CALL_TYPE       : String?
  ) returns Integer;

    action massCreateUsers (entries: array of CORE_USERS);
    action massDeleteUsers ();

    action massCreateAuthMatrix (entries: array of AUTH_MATRIX);
    action massDeleteAuthMatrix ();

    action massCreateConfigLdata (entries: array of CONFIG_LDATA);
    action massDeleteConfigLdata ();

    function userInfo() returns LoggedUserInfo;

 
  action customComment(
    REQ_TXN_ID: UUID,
    TASK_TYPE: String,
    DECISION: String,
    COMMENTS: String,
    CREATED_BY: String
  ) returns array of CORE_COMMENTS;
}

service ReportService {
  
  @readonly
  entity TE_REPORT_VIEW as select from core.TE_SR as sr
    left outer join (
    select from core.MON_WF_TASK as t { REQ_TXN_ID, ASSIGNED_GROUP, TASK_TYPE, TASK_STATUS, PROCESSOR, UPDATED_DATETIME }
    where t.UPDATED_DATETIME = (
        select max(x.UPDATED_DATETIME)
        from core.MON_WF_TASK as x
        where x.REQ_TXN_ID = t.REQ_TXN_ID
      )
    ) as task on sr.REQ_TXN_ID = task.REQ_TXN_ID
    left outer join core.CORE_USERS as user on sr.CREATED_BY = user.USER_EMAIL and user.language = 'EN'
    left outer join core.CONFIG_LDATA as cat on cat.CODE = sr.SRV_CAT_CD and cat.OBJECT = 'SRV_CAT' and cat.language = 'EN'
    left outer join core.CONFIG_LDATA as status on status.CODE = sr.STATUS_CD and status.OBJECT = 'STATUS' and status.language = 'EN'
    left outer join core.CONFIG_LDATA as entity on entity.CODE = sr.ENTITY_CD and entity.OBJECT = 'ENTITY' and entity.language = 'EN'
  {
    key sr.REQ_TXN_ID   as REQ_TXN_ID,
    sr.REQUEST_ID       as CASE_ID,
    sr.DRAFT_ID         as DRAFT_ID,
    sr.SRV_CAT_CD       as SRV_CAT_CD,
    cat.DESC            as SRV_CAT,
    sr.REPORT_NO        as REPORT_NO,
    sr.CREATED_DATETIME as CREATED_DATETIME,
    sr.UPDATED_DATETIME as UPDATED_DATETIME,

    sr.STATUS_CD        as STATUS_CD,
    status.DESC         as STATUS,

    sr.ENTITY_CD        as ENTITY_CD,
    entity.DESC         as ENTITY,

    sr.CREATED_BY       as CREATED_BY,
    user.USER_ID        as CREATED_BY_EMPID,
    concat(user.USER_FNAME, ' ', user.USER_LNAME) as CREATED_BY_NAME : String,

    sr.PROCESSOR        as SR_PROCESSOR,
    task.PROCESSOR      as TASK_PROCESSOR,
    task.ASSIGNED_GROUP,
    task.TASK_TYPE,
    task.TASK_STATUS,
    sr.IS_CLAR_REQ_DATETIME as IS_CLAR_REQ_DATETIME,
    sr.ESCALATED_DATETIME   as ESCALATED_DATETIME,
    sr.RESOLVED_DATETIME    as RESOLVED_DATETIME,
    sr.CLOSED_DATETIME      as CLOSED_DATETIME,
    virtual VARIENT     : commonTypes.reportVariant,
    virtual user_scim_id : String @cds.odata.name:'user-scim-id'
  } order by sr.UPDATED_DATETIME desc;

  entity CONFIG_LDATA as projection on core.CONFIG_LDATA;
}

service WorkflowService {
  entity MON_WF_TASK @(path: '') as projection on core.MON_WF_TASK;
}
