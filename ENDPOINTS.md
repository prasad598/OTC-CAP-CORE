# API Endpoints

Below are the REST paths and example payloads for the services exposed by this project.

## /rest/btp/core/users

**GET** `/rest/btp/core/users`

Returns a list of user records.

**POST** `/rest/btp/core/users`

```json
{
  "USER_EMAIL": "user@example.com",
  "USER_ID": 1,
  "USER_HP": "+1234567890",
  "USER_FNAME": "John",
  "USER_LNAME": "Doe",
  "IS_ACTIVE": true,
  "CREATED_BY": "admin",
  "UPDATED_BY": "admin"
}
```

---

## /rest/btp/core/attachments

**GET** `/rest/btp/core/attachments`

Retrieves uploaded attachments.

**POST** `/rest/btp/core/attachments`

```json
{
  "REQ_TXN_ID": 1001,
  "REQUEST_NO": "REQ-0001",
  "FILE_NAME": "document.pdf",
  "FILE_SIZE": 1024,
  "FILE_PATH": "/files/document.pdf",
  "MIME_TYPE": "application/pdf",
  "DOCUMENT_TYPE": "invoice",
  "PROJECT_TYPE": "PROJECT_A",
  "USER_TYPE": "Requester",
  "RESTRICTED_USR_TY": "Manager",
  "INC_AS_ATTACHMENT": "Y",
  "IS_ARCHIVED": "N",
  "ARCH_FILE_PATH": "/archive/document.pdf",
  "CREATED_BY": "admin",
"CREATED_DATE": "2024-01-01T00:00:00Z"
}
```

---

## /rest/btp/core/auth-matrix

**GET** `/rest/btp/core/auth-matrix`

Retrieves authorization matrix records.

**POST** `/rest/btp/core/auth-matrix`

```json
{
  "ASSIGNED_GROUP": "Approvers",
  "USER_EMAIL": "user@example.com",
  "FIELD1": "value1",
  "FIELD2": "value2",
  "FIELD3": "value3",
  "CREATED_BY": "admin",
  "CREATED_TIMESTAMP": "2024-01-01T00:00:00Z",
  "UPDATED_BY": "admin",
  "UPDATED_TIMESTAMP": "2024-01-01T00:00:00Z"
}
```

---

## /rest/btp/core/comments

**GET** `/rest/btp/core/comments`

Retrieves comments associated with requests.

**POST** `/rest/btp/core/comments`

```json
{
  "REQ_TXN_ID": "550e8400-e29b-41d4-a716-446655440000",
  "REQUEST_NO": "REQ-0001",
  "COMMENTS": "Sample comment",
  "COMMENT_TYPE": "document",
  "COMMENT_EVENT": "Service Request Created",
  "USER_TYPE": "Requester",
  "EVENT_STATUS_CD": "NEW",
  "CREATED_BY": "user@example.com",
  "CREATED_DATE": "2024-01-01T00:00:00Z"
}
```

---

## /rest/btp/core/workflow-process

**GET** `/rest/btp/core/workflow-process`

Lists workflow processes.

**POST** `/rest/btp/core/workflow-process`

```json
{
  "WF_INSTANCE_ID": 1,
  "WF_DESC": "Process description",
  "WF_SUBJ": "Process subject",
  "WF_STATUS": "ACTIVE",
  "REQUEST_TYPE": "TE",
  "REQUEST_ID": "CASE-0001",
  "REQ_TXN_ID": 1001,
  "EST_COMPLETION": "2024-01-02T00:00:00Z",
  "ACTUAL_COMPLETION": "2024-01-03T00:00:00Z",
  "COMPLETED_BY": "user@example.com",
  "SLA_DAYS": 5,
  "IS_ACTIVE": "Y",
  "IS_ARCHIVED": "N",
  "IS_DELETED": "N",
  "CREATED_BY": "admin",
  "CREATED_DATETIME": "2024-01-01T00:00:00Z",
  "UPDATED_BY": "admin",
  "UPDATED_DATETIME": "2024-01-01T00:00:00Z"
}
```

---

## /rest/btp/core/workflow-task

**GET** `/rest/btp/core/workflow-task`

Lists workflow tasks.

**POST** `/rest/btp/core/workflow-task`

Provide the `SWF_INSTANCE_ID` to retrieve task details from the workflow
service. Fields such as `TASK_INSTANCE_ID`, `TASK_STATUS`, `TASK_SUBJ`, and
`ASSIGNED_GROUP` are populated automatically. Any `TASK_INSTANCE_ID` supplied
in the request body is ignored.

```json
{
  "WF_INSTANCE_ID": 1,
  "SWF_INSTANCE_ID": "badd8bcb-72af-11f0-bbe6-eeee0a87f288",
  "REQ_TXN_ID": 1001
}
```

---

## /rest/btp/core/te-servicerequest

**GET** `/rest/btp/core/te-servicerequest`

Retrieves service request records.

**POST** `/rest/btp/core/te-servicerequest`

Submits a new service request. Provide `DECISION` as "DRAFT" or "SUBMIT" to
have the service generate the corresponding `DRAFT_ID` or `REQUEST_ID`.

```json
{
  "DECISION": "DRAFT",
  "REQUESTER_ID": "requester@example.com",
  "SRV_CAT_CD": "CAT1",
  "SR_DETAILS": "Details of the service request",
  "CASE_REQ_ID": "CASE1",
  "REQ_FOR_NAME": "Jane",
  "REQ_FOR_EMAIL": "jane@example.com",
  "REPORT_NO": "REP-0001",
  "CASE_PRIO": "1",
  "ENTITY_CD": "ENT1",
  "SECTOR_CD": "SEC1",
  "STATUS_CD": "NEW",
  "RESOLUTION_RES": "Resolution details",
  "CASE_BCG": "Background info",
  "SRC_PROB_CD": "SRC1",
  "IS_CLAR_REQ": false,
  "IS_CLAR_REQ_DATETIME": "2024-01-02T00:00:00Z",
  "IS_ESCALATED": false,
  "ESCALATED_DATETIME": "2024-01-03T00:00:00Z",
  "IS_CONFIRMED": false,
  "CONFIRMED_DATETIME": "2024-01-04T00:00:00Z",
  "CREATED_BY": "admin",
  "CREATED_DATETIME": "2024-01-01T00:00:00Z",
  "UPDATED_BY": "admin",
  "UPDATED_DATETIME": "2024-01-01T00:00:00Z"
}
```

---

## /odata/v4/workflow

**POST** `/odata/v4/workflow`

Creates a workflow task using the same logic as the REST endpoint. Provide the
`SWF_INSTANCE_ID` to retrieve task details from the workflow service. Fields
such as `TASK_INSTANCE_ID`, `TASK_STATUS`, `TASK_SUBJ`, and `ASSIGNED_GROUP` are
populated automatically.

```json
{
  "WF_INSTANCE_ID": 1,
  "SWF_INSTANCE_ID": "badd8bcb-72af-11f0-bbe6-eeee0a87f288",
  "REQ_TXN_ID": 1001
}
```

