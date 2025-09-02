# API Endpoints

Below are the REST paths and example payloads for the services exposed by this project.

## /rest/btp/scim/Users/{id}

**GET** `/rest/btp/scim/Users/{id}`

Fetches an IAS user by SCIM ID and returns a simplified payload.

```json
{
  "id": "e935be24-1ead-4b8a-ab82-d0acac6be4e4",
  "fullName": "Prasad RESO TEAM",
  "honorificPrefix": "Mr.",
  "email": "nagavaraprasad.bandaru@stengg.com",
  "entity": "9889",
  "employeeId": "70006263",
  "mobile": "97373465",
  "groups": ["Build Apps Group"]
}
```

---

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
    "REQUEST_ID": "REQ-0001",
    "FILE_NAME": "document.pdf",
    "FILE_SIZE": 1024,
    "FILE_PATH": "/files/document.pdf",
    "MIME_TYPE": "application/pdf",
    "DOCUMENT_TYPE": "invoice",
    "PROJECT_TYPE": "PROJECT_A",
    "USER_TYPE": "TE Requester",
    "RESTRICTED_USR_TY": "Manager",
    "INC_AS_ATTACHMENT": "Y",
    "IS_ARCHIVED": "N",
    "ARCH_FILE_PATH": "/archive/document.pdf",
    "CREATED_BY": "admin",
    "CREATED_DATETIME": "2024-01-01T00:00:00Z"
  }
```

**Response**

Returns all attachments for the specified `REQ_TXN_ID`.

```json
[
  {
    "UUID": "00112233-4455-6677-8899-aabbccddeeff",
    "REQ_TXN_ID": 1001,
    "FILE_NAME": "document.pdf",
    "FILE_PATH": "/files/document.pdf",
    "MIME_TYPE": "application/pdf",
    "PROJECT_TYPE": "PROJECT_A"
  }
]
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
    "CREATED_DATETIME": "2024-01-01T00:00:00Z",
    "UPDATED_BY": "admin",
    "UPDATED_DATETIME": "2024-01-01T00:00:00Z"
  }
```

---

## /rest/btp/core/sendReport

**POST** `/rest/btp/core/sendReport`

Generates an Excel report from `TE_REPORT_VIEW` based on the provided filter
criteria and emails the file to the logged-in user. Optional comma-separated
`TO_EMAILS` and `CC_EMAILS` lists may be supplied.

```json
{
  "TO_EMAILS": "user1@example.com,user2@example.com",
  "CC_EMAILS": "manager@example.com",
  "CASE_ID": "CASE-001",
  "STATUS_CD": "OPEN",
  "CREATED_DATETIME": {"from": "2024-01-01T00:00:00Z", "to": "2024-01-31T23:59:59Z"}
}
```

Returns `{"status":"success","count":<rows>}` when the email is sent.

---

## /rest/btp/core/comments

**GET** `/rest/btp/core/comments`

Retrieves comments associated with requests.

**POST** `/rest/btp/core/comments`

```json
{
    "REQ_TXN_ID": "550e8400-e29b-41d4-a716-446655440000",
    "REQUEST_ID": "REQ-0001",
    "COMMENTS": "Sample comment",
    "COMMENT_TYPE": "",
    "COMMENT_EVENT": "",
    "USER_TYPE": "Requester",
    "EVENT_STATUS_CD": "",
    "CREATED_BY": "user@example.com",
    "CREATED_DATETIME": "2024-01-01T00:00:00Z"
  }
```

Alternatively, a minimal payload can be used:

```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "comment": "Sample comment"
}
```

**Response**

Returns all comments for the specified `REQ_TXN_ID`.

```json
[
  {
    "UUID": "00112233-4455-6677-8899-aabbccddeeff",
    "REQ_TXN_ID": "550e8400-e29b-41d4-a716-446655440000",
    "COMMENTS": "Sample comment",
    "COMMENT_TYPE": "",
    "COMMENT_EVENT": "",
    "USER_TYPE": "Requester",
    "EVENT_STATUS_CD": "",
    "CREATED_BY": "user@example.com",
    "CREATED_DATETIME": "2024-01-01T00:00:00Z"
  }
]
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
service. Fields such as `TASK_INSTANCE_ID`, `TASK_STATUS`, and `TASK_SUBJ` are
populated automatically. `ASSIGNED_GROUP` and `TASK_TYPE` must be supplied in
the request body to be stored. Any `TASK_INSTANCE_ID` supplied in the request
body is ignored.

```json
{
  "WF_INSTANCE_ID": 1,
  "SWF_INSTANCE_ID": "badd8bcb-72af-11f0-bbe6-eeee0a87f288",
  "REQ_TXN_ID": 1001,
  "TASK_TYPE": "Approval",
  "ASSIGNED_GROUP": "Approvers"
}
```

---

## /rest/btp/core/onTaskEvent

**POST** `/rest/btp/core/onTaskEvent`

Creates or updates workflow task monitoring records based on `HTTP_CALL`. When
`HTTP_CALL` is `POST`, a new record is created using task details from SAP
Process Automation. For `PATCH`, the existing record is updated. In both cases,
the service request status and workflow process status are updated based on the
provided task information. `SWF_INSTANCE_ID`, `REQ_TXN_ID` and `HTTP_CALL` are
mandatory; all other parameters, including `REQUEST_TYPE` (defaults to `TE`), are
optional.

All responses return a JSON object with exactly four properties: `status`,
`message`, `REQ_TXN_ID` and `correlationId`. Only the status code and message
change according to the action outcome.

```json
{
  "SWF_INSTANCE_ID": "badd8bcb-72af-11f0-bbe6-eeee0a87f288",
  "REQ_TXN_ID": "00112233-4455-6677-8899-aabbccddeeff",
  "REQUEST_TYPE": "TE",
  "TASK_TYPE": "TE_REQUESTER",
  "TASK_STATUS": "COMPLETED",
  "DECISION": "APR",
  "PROCESSOR": "user@example.com",
  "ASSIGNED_GROUP": "TE_RESO_TEAM",
  "COMPLETED_AT": "2024-01-01T00:00:00Z",
  "HTTP_CALL": "POST"
}
```

**Success Response**

```json
{
  "status": 201,
  "message": "Task record created",
  "REQ_TXN_ID": "00112233-4455-6677-8899-aabbccddeeff",
  "correlationId": "2f7929f8-dd8d-4209-7c39-7c9cedbe43b5"
}
```

**Error Response**

```json
{
  "status": 400,
  "message": "Missing required field: TASK_TYPE",
  "REQ_TXN_ID": "",
  "correlationId": "2f7929f8-dd8d-4209-7c39-7c9cedbe43b5"
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
  "STATUS_CD": "NEW",
  "RESOLUTION_RES": "Resolution details",
  "CASE_BCG_CD": "BCG1",
  "SRC_PROB_CD": "SRC1",
  "IS_CLAR_REQ_DATETIME": "2024-01-02T00:00:00Z",
  "ESCALATED_DATETIME": "2024-01-03T00:00:00Z",
  "RESOLVED_DATETIME": "2024-01-04T00:00:00Z",
  "CLOSED_DATETIME": "2024-01-05T00:00:00Z",
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
such as `TASK_INSTANCE_ID`, `TASK_STATUS`, and `TASK_SUBJ` are populated
automatically. `ASSIGNED_GROUP` and `TASK_TYPE` must be supplied in the request
body to be stored.

```json
{
  "WF_INSTANCE_ID": 1,
  "SWF_INSTANCE_ID": "badd8bcb-72af-11f0-bbe6-eeee0a87f288",
  "REQ_TXN_ID": 1001,
  "TASK_TYPE": "Approval",
  "ASSIGNED_GROUP": "Approvers"
}
```

