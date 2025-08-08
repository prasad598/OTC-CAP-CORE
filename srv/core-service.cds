using BTP as core from '../db/schema';

service RestService @(path: '/rest/btp/core', protocol: 'rest') {
  entity CORE_ATTACHMENTS @(path: 'attachments') as projection on core.CORE_ATTACHMENTS;

  entity CORE_COMMENTS @(path: 'comments') as projection on core.CORE_COMMENTS;

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
    CASE_BCG         : String,
    SRC_PROB_CD      : String
  ) returns {
    status : String;
  };

    action massCreateUsers (entries: array of CORE_USERS);
    action massDeleteUsers (emails: array of String);

    action massCreateAuthMatrix (entries: array of AUTH_MATRIX);
    action massDeleteAuthMatrix (keys: array of {
      ASSIGNED_GROUP: String;
      USER_EMAIL: String;
    });

    action massCreateConfigLdata (entries: array of CONFIG_LDATA);
    action massDeleteConfigLdata (keys: array of {
      REQUEST_TYPE: String;
      OBJECT: String;
      CODE: String;
    });
}

service ReportService {
  
  @readonly
  entity TE_REPORT_VIEW as select from core.TE_SR as sr
    left outer join (
    select from core.MON_WF_TASK as t { REQ_TXN_ID, ASSIGNED_GROUP, TASK_TYPE, UPDATED_DATETIME }
    where t.UPDATED_DATETIME = (
        select max(x.UPDATED_DATETIME)
        from core.MON_WF_TASK as x
        where x.REQ_TXN_ID = t.REQ_TXN_ID
      )
    ) as task on sr.REQ_TXN_ID = task.REQ_TXN_ID
    left outer join core.CORE_USERS as user on sr.CREATED_BY = user.USER_EMAIL
    left outer join core.CONFIG_LDATA as cat on cat.CODE = sr.SRV_CAT_CD and cat.REQUEST_TYPE = 'SRV_CAT'
    left outer join core.CONFIG_LDATA as status on status.CODE = sr.STATUS_CD and status.REQUEST_TYPE = 'STATUS'
    left outer join core.CONFIG_LDATA as entity on entity.CODE = sr.ENTITY_CD and entity.REQUEST_TYPE = 'ENTITY'
  {
    key sr.REQ_TXN_ID   as REQ_TXN_ID,
    sr.REQUEST_ID       as CASE_ID,
    sr.SRV_CAT_CD       as SERVICE_CATEGORY_CODE,
    cat.DESC            as SERVICE_CATEGORY,
    sr.CASE_REQ_ID      as REQUEST_ID,
    sr.CREATED_DATETIME as CREATION_DATE,

    sr.STATUS_CD        as STATUS_CODE,
    status.DESC         as STATUS,

    sr.ENTITY_CD        as ENTITY_CODE,
    entity.DESC         as ENTITY,

    sr.CREATED_BY       as CREATED_BY_EMAIL,
    user.USER_ID        as CREATED_BY,
    concat(user.USER_FNAME, ' ', user.USER_LNAME) as CREATED_BY_NAME : String,

    task.ASSIGNED_GROUP,
    task.TASK_TYPE
  };

  entity CONFIG_LDATA as projection on core.CONFIG_LDATA;
}

service WorkflowService {
  entity MON_WF_TASK @(path: '') as projection on core.MON_WF_TASK;
}
