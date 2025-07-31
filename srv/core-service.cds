using { BTP_CORE_USERS } from '../db/schema';

service UserService {
  entity BTP_CORE_USERS as projection on BTP_CORE_USERS;
}
