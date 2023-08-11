CREATE MIGRATION m1llkqxzqq3fxqwza77cfk6xydcghrzhsmhyknvgrefvdw5ntsj6gq
    ONTO m1fmqcwgzvkve5zaexz2qzd326ilc4xem2lrebzhsqhtrfv3iyhkza
{
  ALTER TYPE default::Agreement {
      ALTER LINK versions {
          CREATE CONSTRAINT std::exclusive;
      };
      ALTER LINK versions {
          RESET OPTIONALITY;
      };
  };
  ALTER TYPE default::AgreementVersion {
      ALTER LINK texts {
          CREATE CONSTRAINT std::exclusive;
      };
      ALTER LINK texts {
          RESET OPTIONALITY;
      };
  };
};
