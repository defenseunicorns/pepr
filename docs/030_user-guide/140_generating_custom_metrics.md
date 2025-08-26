# Generating Custom Metrics

Pepr provides a `metricCollector` utility that lets you define custom metrics such as counters and gauges for your module.

For example, to track how often a specific event occurs, you can create a custom counter and gauge like this:

```typescript
import { Capability, a, metricsCollector } from "pepr";

export const HelloPepr = new Capability({
  name: "hello-pepr",
  description: "An example using the metric collector.",
});

// Register a metric collector to count the number of times the hello-pepr label has been applied
metricsCollector.addCounter(
  "label_counter",
  "example counter for counting number of times hello-pepr label has been applied",
);

// Register a gauge to count how many times a given label has been applied
metricsCollector.addGauge(
  "label_guage",
  "example gauge for counting how times times a given label has been applied",
  ["label"],
);

const { When } = HelloPepr;
When(a.Pod)
  .IsCreatedOrUpdated()
  .Mutate(po => {
    po.SetLabel("hello-pepr", "true");
    po.SetLabel("blue", "true");
    po.SetLabel("green", "true");
    metricsCollector.incCounter("label_counter");
    metricsCollector.incGauge("label_guage", { label: "blue" }, 1);
    metricsCollector.incGauge("label_guage", { label: "green" }, 1);
    metricsCollector.incGauge("label_guage", { label: "hello-pepr" }, 1);
  });
```

You can access these metrics through the `/metrics` endpoint of your module. For example, if you are running `npx pepr dev --yes`, you can create some pods and then query the metrics like this:

```bash
terminal_a > npx pepr dev --yes
terminal_b > curl -k http://localhost:3000/metrics
...
# HELP pepr_label_counter example counter for counting number of times hello-pepr label has been applied
# TYPE pepr_label_counter counter
pepr_label_counter 0

# HELP pepr_label_guage example gauge for counting how times times a given label has been applied
# TYPE pepr_label_guage gauge
terminal_b > kubectl run a --image=nginx 
terminal_b > kubectl run b --image=nginx
terminal_b > kubectl run c --image=nginx
terminal_b > curl -k http://localhost:3000/metrics
...
# TYPE pepr_label_counter counter
pepr_label_counter 3

# HELP pepr_label_guage example gauge for counting how times times a given label has been applied
# TYPE pepr_label_guage gauge
pepr_label_guage{label="blue"} 3
pepr_label_guage{label="green"} 3
pepr_label_guage{label="hello-pepr"} 3
```
