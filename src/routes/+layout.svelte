<script lang="ts">
  import "../app.css";

  let darkMode = $state(false);

  function toggleDarkMode() {
    darkMode = !darkMode;
  }

  let { children } = $props();
</script>

<div class="min-h-screen transition-colors duration-300" class:dark={darkMode}>
  <div
    class="flex min-h-screen flex-col justify-center bg-gray-100 py-6 sm:py-12 dark:bg-gray-900"
  >
    <div class="relative py-3 sm:mx-auto sm:max-w-xl">
      <button
        onclick={toggleDarkMode}
        class="absolute right-4 top-4 rounded-full bg-gray-200 p-2 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
      >
        {#if darkMode}
          🌞
        {:else}
          🌙
        {/if}
      </button>
      {@render children()}
    </div>
  </div>
</div>
