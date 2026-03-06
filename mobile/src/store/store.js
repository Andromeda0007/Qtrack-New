import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import materialReducer from "./materialSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    materials: materialReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

