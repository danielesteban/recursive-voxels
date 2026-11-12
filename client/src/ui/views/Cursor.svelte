<script lang="ts">
</script>

<div class="cursor"></div>

<style>
  .cursor {
    display: none;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 0.5rem;
    height: 0.5rem;
    border: 0.25rem solid rgb(238, 238, 238, 0.3);
    border-radius: 0.5rem;
    box-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.3);
    z-index: 1;
  }

  :global(body.pointerlock) .cursor {
    display: block;
  }
</style>
