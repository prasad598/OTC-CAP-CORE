using BTP as core from '../db/schema';

service UserService {
  @readonly entity CORE_USERS as projection on core.CORE_USERS;
}
