let error = $state<string | null>(null);
let isConnecting = $state(false);
let isLoading = $state(true);

export const Status = {
  get error() { return error },
  set error(value) { error = value },
  get isConnecting() { return isConnecting },
  set isConnecting(value) { isConnecting = value },
  get isLoading() { return isLoading },
  set isLoading(value) { isLoading = value },
};
