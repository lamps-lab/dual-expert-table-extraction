/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the runtime
  // image only needs the traced node_modules, not the full dependency tree.
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
