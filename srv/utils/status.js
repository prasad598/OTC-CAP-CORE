const { Decision, TaskType, RequestType, Status } = require('./enums');

function generateReqNextStatus(requestType, taskType, decision) {
  // console.log(
  //   `generateReqNextStatus called with requestType=${requestType}, taskType=${taskType}, decision=${decision}`
  // );
  if (requestType === RequestType.TE) {
    switch (taskType) {
      case TaskType.TE_REQUESTER:
        switch (decision) {
          case Decision.DRF:
            return Status.DRF;
          case Decision.SUB:
          case Decision.RSB:
            return Status.PRT;
          case Decision.CLDA:
            return Status.CLD;
          case Decision.NA:
            return Status.PRC;
          default:
            return Status.ERR;
        }
      case TaskType.TE_RESO_TEAM:
        switch (decision) {
          case Decision.APR:
            return Status.RSL;
          case Decision.REJ:
            return Status.CLR;
          case Decision.ESL:
            return Status.PRL;
          case Decision.ESLA:
            return Status.PRL;
          case Decision.NA:
            return Status.PRC;
          default:
            return Status.ERR;
        }
      case TaskType.TE_RESO_LEAD:
        switch (decision) {
          case Decision.APR:
            return Status.RSL;
          case Decision.REJ:
            return Status.CLR;
          case Decision.NA:
            return Status.PRC;
          default:
            return Status.ERR;
        }
      default:
        return Status.ERR;
    }
  }
  return Status.ERR;
}

module.exports = { generateReqNextStatus };
