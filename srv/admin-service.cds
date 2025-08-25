using BTP as core from '../db/schema';

service AdminService @(path: '/admin', protocol: 'rest') {
  action purgeAllData returns { status: String; };
}
