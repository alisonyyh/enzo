import posthog from 'posthog-js';

posthog.init('phc_BCuPQA9cSnw3YyR9yiyEvkR6X94eG8TgLDm87ZcrW67S', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
});

export { posthog };
