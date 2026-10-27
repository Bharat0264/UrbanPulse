import { StrictMode, Suspense, lazy, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Preferences } from "./hooks/context";
import Shell from "./components/layout/Shell";
import { State } from "./components/layout/UI";
import "./styles/global.css";
const Landing = lazy(() => import("./pages/Landing"));
const Command = lazy(() => import("./pages/Command"));
const Geographic = lazy(() => import("./pages/Geographic"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Predict = lazy(() => import("./pages/Predict"));
const Spark = lazy(() => import("./pages/Spark"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <State error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={new QueryClient()}>
        <Preferences>
          <BrowserRouter>
            <Suspense fallback={<State loading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<Shell />}>
                  <Route index element={<Command />} />
                  <Route path="geo" element={<Geographic />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="predict" element={<Predict />} />
                  <Route path="spark" element={<Spark />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <div className="state">
                      <h1>Page not found</h1>
                      <Link to="/app">Return to Command Center</Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </Preferences>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
