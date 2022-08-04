CREATE MIGRATION m1fmqcwgzvkve5zaexz2qzd326ilc4xem2lrebzhsqhtrfv3iyhkza
    ONTO m1gibmer4jzdtynetjkyk5iptdavgrgxf5golmpxdm4zmnwvsrvypq
{
  ALTER TYPE default::ContributorLicenseAgreement {
      ALTER PROPERTY normalized_email {
          USING (default::normalize_email(.email));
      };
  };
};
