const baseRule = {
  name: "string",
  policy_type: "Security",
  disabled: false,
  description: "string",
  tag: ["string"],
  from: ["any"],
  to: ["any"],
  source: ["any"],
  negate_source: false,
  source_user: ["any"],
  destination: ["any"],
  service: ["any"],
  schedule: "string",
  negate_destination: false,
  source_hip: ["any"],
  destination_hip: ["any"],
  application: ["any"],
  category: ["any"],
  profile_setting: {
    group: ["best-practice"],
  },
  log_setting: "string",
  log_start: true,
  log_end: true,
  tenant_restrictions: ["any"],
  folder: "string",
};

const baseZone = {
  name: "string",
  folder: "My Folder",
  enable_user_identification: true,
  enable_device_identification: true,
  dos_profile: "string",
  dos_log_setting: "string",
  network: ["string"],
  user_acl: {
    include_list: ["string"],
    exclude_list: ["string"],
  },
  device_acl: {
    include_list: ["string"],
    exclude_list: ["string"],
  },
};

const unwrapMembers = (field, defaultVal = ["any"]) => {
  if (!field) return defaultVal;

  // if array of objects
  if (Array.isArray(field)) {
    return field.flatMap((item) => {
      if (item.member) {
        return Array.isArray(item.member) ? item.member : [item.member];
      }
      return item;
    });
  }

  // if object with member
  if (field.member) {
    return Array.isArray(field.member) ? field.member : [field.member];
  }

  // if already string
  return [field];
};

const createSecurityRules = (ruleData) => {
  return ruleData.map((rule) => ({
    name: rule["@name"],
    policy_type: "Security",
    disabled: false,
    description: rule.description,

    tag: unwrapMembers(rule.tag, []),

    from: unwrapMembers(rule.from),
    to: unwrapMembers(rule.to),
    source: unwrapMembers(rule.source),

    negate_source: false,

    source_user: unwrapMembers(rule["source-user"]),
    destination: unwrapMembers(rule.destination),
    service: unwrapMembers(rule.service),

    action: rule.action,

    application: unwrapMembers(rule.application),
    category: unwrapMembers(rule.category),

    profile_setting: { group: ["best-practice"] },
    log_start: true,
    log_end: true,
    folder: "ngfw-shared",
  }));
};

const createZones = (zoneData) => {
  const zones = [];

  zoneData.forEach((zone) => {
    zones.push({
      name: zone["@name"],
      folder: "ngfw-shared",
      enable_user_identification: false,
      enable_device_identification: false,
    });
  });

  return zones;
};

const createTags = (tagData) => {
  const tags = [];

  tagData.forEach((tag) => {
    tags.push({
      name: tag["@name"],
      comments: tag.comments,
      folder: "ngfw-shared",
    });
  });

  return tags;
};

const createAddressObjects = (addressData, device) => {
  const addresses = [];

  addressData.forEach((address) => {
    addresses.push({
      name: address["@name"],
      description: address.description,
      tag: unwrapMembers(address.tag, []),
      ip_netmask: address["ip-netmask"],
      folder: device,
    });
  });

  return addresses;
};

module.exports = {
  createSecurityRules,
  createZones,
  createTags,
  createAddressObjects,
};
