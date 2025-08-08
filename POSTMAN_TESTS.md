# Service Test Reference

Use these examples to quickly exercise the REST services with Postman.

## CORE_USERS
- **Service Path**: `/rest/btp/core/users`
- **Service Type**: REST
- **GET** `/rest/btp/core/users`
- **POST** `/rest/btp/core/users`
```json
{
  "USER_EMAIL": "user@example.com",
  "USER_ID": 1,
  "USER_FNAME": "John",
  "USER_LNAME": "Doe",
  "IS_ACTIVE": "Y",
  "CREATED_BY": "tester",
  "UPDATED_BY": "tester"
}
```
- **PATCH** `/rest/btp/core/users(USER_EMAIL='user@example.com',language='EN')`
```json
{
  "USER_FNAME": "Jane"
}
```
- **DELETE** `/rest/btp/core/users(USER_EMAIL='user@example.com',language='EN')`
- **Mass Create** `POST /rest/btp/core/massCreateUsers`
```json
{
  "entries": [
    { "USER_EMAIL": "u1@example.com", "USER_ID": 1, "CREATED_BY": "tester", "UPDATED_BY": "tester" },
    { "USER_EMAIL": "u2@example.com", "USER_ID": 2, "CREATED_BY": "tester", "UPDATED_BY": "tester" }
  ]
}
```
- **Mass Delete** `POST /rest/btp/core/massDeleteUsers`
```json
{
  "emails": ["u1@example.com", "u2@example.com"]
}
```

## AUTH_MATRIX
- **Service Path**: `/rest/btp/core/auth-matrix`
- **Service Type**: REST
- **GET** `/rest/btp/core/auth-matrix`
- **POST** `/rest/btp/core/auth-matrix`
```json
{
  "ASSIGNED_GROUP": "Approvers",
  "USER_EMAIL": "user@example.com",
  "FIELD1": "value1",
  "CREATED_BY": "tester",
  "UPDATED_BY": "tester"
}
```
- **PATCH** `/rest/btp/core/auth-matrix(ASSIGNED_GROUP='Approvers',USER_EMAIL='user@example.com',language='EN')`
```json
{
  "FIELD1": "new value"
}
```
- **DELETE** `/rest/btp/core/auth-matrix(ASSIGNED_GROUP='Approvers',USER_EMAIL='user@example.com',language='EN')`
- **Mass Create** `POST /rest/btp/core/massCreateAuthMatrix`
```json
{
  "entries": [
    { "ASSIGNED_GROUP": "G1", "USER_EMAIL": "u1@example.com", "CREATED_BY": "tester", "UPDATED_BY": "tester" },
    { "ASSIGNED_GROUP": "G2", "USER_EMAIL": "u2@example.com", "CREATED_BY": "tester", "UPDATED_BY": "tester" }
  ]
}
```
- **Mass Delete** `POST /rest/btp/core/massDeleteAuthMatrix`
```json
{
  "keys": [
    { "ASSIGNED_GROUP": "G1", "USER_EMAIL": "u1@example.com" },
    { "ASSIGNED_GROUP": "G2", "USER_EMAIL": "u2@example.com" }
  ]
}
```

## CONFIG_LDATA
- **Service Path**: `/rest/btp/core/CONFIG_LDATA`
- **Service Type**: REST
- **GET** `/rest/btp/core/CONFIG_LDATA`
- **POST** `/rest/btp/core/CONFIG_LDATA`
```json
{
  "REQUEST_TYPE": "RT",
  "OBJECT": "OBJ",
  "CODE": "001",
  "DESC": "Sample",
  "CREATED_BY": "tester",
  "UPDATED_BY": "tester"
}
```
- **PATCH** `/rest/btp/core/CONFIG_LDATA(REQUEST_TYPE='RT',OBJECT='OBJ',CODE='001',language='EN')`
```json
{
  "DESC": "Updated"
}
```
- **DELETE** `/rest/btp/core/CONFIG_LDATA(REQUEST_TYPE='RT',OBJECT='OBJ',CODE='001',language='EN')`
- **Mass Create** `POST /rest/btp/core/massCreateConfigLdata`
```json
{
  "entries": [
    { "REQUEST_TYPE": "RT", "OBJECT": "OBJ", "CODE": "001", "DESC": "one", "CREATED_BY": "tester", "UPDATED_BY": "tester" },
    { "REQUEST_TYPE": "RT", "OBJECT": "OBJ", "CODE": "002", "DESC": "two", "CREATED_BY": "tester", "UPDATED_BY": "tester" }
  ]
}
```
- **Mass Delete** `POST /rest/btp/core/massDeleteConfigLdata`
```json
{
  "keys": [
    { "REQUEST_TYPE": "RT", "OBJECT": "OBJ", "CODE": "001" },
    { "REQUEST_TYPE": "RT", "OBJECT": "OBJ", "CODE": "002" }
  ]
}
```
