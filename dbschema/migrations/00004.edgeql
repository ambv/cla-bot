CREATE MIGRATION m1mq62xqifdg62gf6oxshidxgnxruewugit5pgsxw6wydiojyytpoq
    ONTO m1xz5pf3vdfhz2jg7irvfbvlu3lxnw4yrv2i4ycj3ygrkvgq3mcq6a
{
  ALTER TYPE default::ContributorLicenseAgreement {
      CREATE PROPERTY normalized_username := (std::str_lower(.username));
      CREATE INDEX ON (.normalized_username);
  };
};
