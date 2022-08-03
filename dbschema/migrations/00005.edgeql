CREATE MIGRATION m1gibmer4jzdtynetjkyk5iptdavgrgxf5golmpxdm4zmnwvsrvypq
    ONTO m1mq62xqifdg62gf6oxshidxgnxruewugit5pgsxw6wydiojyytpoq
{
  CREATE FUNCTION default::remove_plus_suffix_from_email(email: std::str) ->  std::str USING (WITH
      parts :=
          std::str_split(email, '@')
      ,
      is_pseudo_email :=
          ((parts)[-1] = 'users.noreply.github.com')
      ,
      no_plus_suffix :=
          std::re_replace(r'\+.*$', '', (parts)[0])
      ,
      no_plus_prefix :=
          std::re_replace(r'^.*\+', '', (parts)[0])
  SELECT
      (((no_plus_prefix IF is_pseudo_email ELSE no_plus_suffix) ++ '@') ++ (parts)[-1])
  );
  CREATE FUNCTION default::simplify_gmail_address(email: std::str) ->  std::str USING (WITH
      parts :=
          std::str_split(email, '@')
      ,
      is_gmail :=
          ((parts)[-1] = 'gmail.com')
      ,
      no_dots :=
          std::re_replace(r'\.', '', (parts)[0], flags := 'g')
  SELECT
      ((no_dots ++ '@gmail.com') IF is_gmail ELSE email)
  );
  CREATE FUNCTION default::normalize_email(email: std::str) ->  std::str USING (default::simplify_gmail_address(default::remove_plus_suffix_from_email(std::str_lower(email))));
};
