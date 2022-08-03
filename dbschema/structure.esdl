module default {

    type CommentInfo {
        required property comment_id -> str {
            constraint exclusive;
        };
        required property pull_request_id -> int64 {
            constraint exclusive;
        };
        required property creation_time -> datetime {
            default := datetime_current();
        }

        index on (.pull_request_id);
    }

    type Administrator {
        required property email -> str {
            constraint exclusive;
        }
    }

    type Agreement {
        required property name -> str {
            constraint exclusive;
        }

        property description -> str;

        required property creation_time -> datetime {
            default := datetime_current();
        }

        required property update_time -> datetime {
            default := datetime_current();
        }

        multi link versions -> AgreementVersion;
    }

    type AgreementVersion {

        required property current -> bool {
            default := False;
        }

        required property draft -> bool {
            default := true;
        }

        multi link texts -> AgreementText;

        required property creation_time -> datetime {
            default := datetime_current();
        }
    }

    type AgreementText {
        required property text -> str;

        required property title -> str {
            default := "";
        }

        required property culture -> str;

        required property update_time -> datetime {
            default := datetime_current();
        }

        required property creation_time -> datetime {
            default := datetime_current();
        }
    }

    type Repository {
        required property full_name -> str {
            constraint exclusive;
        };

        required link agreement -> Agreement;
    }

    function remove_plus_suffix_from_email(email: str) -> str using (
        with
            parts := str_split(email, '@'),
            is_pseudo_email := parts[-1] = 'users.noreply.github.com',
            no_plus_suffix := re_replace(r'\+.*$', '', parts[0]),
            no_plus_prefix := re_replace(r'^.*\+', '', parts[0])
        select
            (no_plus_prefix if is_pseudo_email else no_plus_suffix) ++ '@' ++ parts[-1]
    );

    function simplify_gmail_address(email: str) -> str using (
        with
          parts := str_split(email, '@'),
          is_gmail := parts[-1] = 'gmail.com',
          no_dots := re_replace(r'\.', '', parts[0], flags := 'g')
        select
          no_dots ++ '@gmail.com' if is_gmail else email
    );

    function normalize_email(email: str) -> str using (
        simplify_gmail_address(
            remove_plus_suffix_from_email(
                str_lower(email)
            )
        )
    );

    type ContributorLicenseAgreement {
        required property email -> str {
            constraint exclusive;
        };
        index on (.email);

        property normalized_email := str_lower(.email);
        constraint exclusive on (.normalized_email);
        index on (.normalized_email);

        property username -> str;

        property normalized_username := str_lower(.username);
        index on (.normalized_username);

        required property creation_time -> datetime {
            default := datetime_current();
        }

        required link agreement_version -> AgreementVersion;

        index on (.agreement_version);
    }
};
