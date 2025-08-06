const { Decision, TaskType, RequestType, Status } = require('./enums');

function generateReqNextStatus(requestType, taskType, decision) {
  if (requestType === RequestType.TE) {
    switch (taskType) {
      case TaskType.TE_REQUESTER:
        switch (decision) {
          case Decision.DRAFT:
            return Status.DRAFT;
          case Decision.SUBMIT:
          case Decision['RE-SUBMIT']:
            return Status.PR;
          default:
            return Status.ERROR;
        }
      case TaskType.TE_RESO:
        switch (decision) {
          case Decision.APPROVED:
            return Status.RESOLVED;
          case Decision.REJECT:
            return Status['RE-SUBMIT'];
          case Decision.ESCALATED:
            return Status.PRL;
          default:
            return Status.ERROR;
        }
      case TaskType.TE_RESO_LEAD:
        switch (decision) {
          case Decision.APPROVED:
            return Status.RESOLVED;
          case Decision.REJECT:
            return Status['RE-SUBMIT'];
          default:
            return Status.ERROR;
        }
      default:
        return Status.ERROR;
    }
  }
  return Status.ERROR;
}

module.exports = { generateReqNextStatus };
