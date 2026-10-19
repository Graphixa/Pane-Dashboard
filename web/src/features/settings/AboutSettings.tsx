import { Section, Text } from "../../design/components";
import { version } from "../../../package.json";

export default function AboutSettings() {
  return (
    <Section
      level="h3"
      className="settings-section"
      title="Pane"
      description={`Version ${version}`}
    >
      <Text>A self-hosted dashboard for your apps.</Text>
      <div className="about-links">
        <a
          href="https://github.com/Graphixa/Pane-Dashboard"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          href="https://github.com/Graphixa/Pane-Dashboard/issues"
          target="_blank"
          rel="noreferrer"
        >
          Report an issue
        </a>
      </div>
    </Section>
  );
}
