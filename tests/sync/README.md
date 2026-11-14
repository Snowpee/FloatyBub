# Sync regression checks

From the repository root:

```sh
node tests/sync/settings-sync.test.mjs
```

The Realtime lifecycle test uses the installed Supabase SDK with network access disabled and isolated React renderers. Prepare its optional dependencies outside the application:

```sh
npm install --prefix /tmp/floaty-sync-tests --no-audit --no-fund react@18.3.1 react-test-renderer@18.3.1
SYNC_TEST_MODULES=/tmp/floaty-sync-tests node tests/sync/realtime-subscriptions.test.cjs
SYNC_TEST_MODULES=/tmp/floaty-sync-tests node tests/sync/auth-data-restore.test.cjs
```

It covers concurrent hook consumers, one store update per database event, partial unmount, repeated auth events, remount while channel removal is pending, late events, account switching and logout. No Supabase credentials or live database are needed.

The auth restoration test covers profile primary keys differing from auth account IDs, concurrent auth hooks, legacy pending-entry ownership, cloud model/role restoration and stale responses after account changes.
