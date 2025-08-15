namespace commonTypes;

type lookupCode : String(30);
type emailId    : String(241);
type field50    : String(50);
type field100   : String(100);
type userId     : String(12);
type dateTime   : Timestamp;
type id         : String(120);
type mobile     : String(30);
type fName      : String(40);
type title      : String(4);
type cc         : String(10);
type department : String(100);
type entity     : String(100);
type booleanYN  : String(1);
type uuid       : UUID;
type fileName   : String(255);
type fileSize   : Integer;
type filePath   : String(1024);
type mimeType   : String(100);
type userType   : String(50);
type flag       : String(1);
type shortText  : String(255);
type requestId  : String(30);
type uuidv4     : String(36);
type requestType: String(30);
type taskType   : String(30);
type statusSBPA : String(20);
type decision   : String(10);
type iasGroup   : String(50);
type commentType : String enum { document; milestone; };
type commentEvent: String enum {
  ServiceRequestCreated        = 'Service Request Created';
  ServiceRequestResolved       = 'Service Request Resolved';
  ServiceRequestNeedClarification = 'Service Request need clarification';
  ServiceRequestAutoClosed     = 'Service Request Auto Closed';
  ServiceRequestEscalated      = 'Service Request Escalated';
  ServiceRequestAutoEscalated  = 'Service Request Auto Escalated';
};

type reportVariant : String enum {
  MY_CASES;
  CLOSED_CASES;
  OPEN_CASES;
  TOTAL_CASES;
  SLA_BREACH_CASES;
};
