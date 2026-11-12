let error = $state<string | null>(null);
let isLoading = $state(true);

export const Status = {
  get error() { return error },
  set error(value) { error = value },
  get isLoading() { return isLoading },
  set isLoading(value) { isLoading = value },
};
