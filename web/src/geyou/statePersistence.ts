type StateStorage=Pick<Storage,'getItem'|'setItem'>;
// Persist at the action boundary. React state updaters must not write storage:
// they may run later or be replayed, overwriting newer actions.
export function persistStateUpdate<T>(storage:StateStorage,key:string,fallback:T,change:(state:T)=>T):T {
 const raw=storage.getItem(key);
 const next=change(raw?JSON.parse(raw) as T:fallback);
 storage.setItem(key,JSON.stringify(next));
 return next;
}
