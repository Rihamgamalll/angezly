/*
# Lock down the sign-up trigger function

1. Plain-English summary
- The function that creates a profile when someone signs up is only meant to run automatically. It is no longer callable directly through the public interface.

2. Security changes
- Revokes direct execution of the sign-up profile function from anonymous and signed-in users.
- The sign-up trigger continues to work because it runs as part of account creation.

3. Important notes
- No data is changed.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
