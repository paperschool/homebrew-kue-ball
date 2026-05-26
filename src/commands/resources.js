import { runLive, runShell, runLiveWithOptionalWatch } from "../lib/runner.js";
import { DIM, RESET } from "../lib/output.js";

const REQ_LIMIT_COLUMNS = [
    "NAME:.metadata.name",
    "CPU_REQ:.spec.containers[*].resources.requests.cpu",
    "CPU_LIM:.spec.containers[*].resources.limits.cpu",
    "MEM_REQ:.spec.containers[*].resources.requests.memory",
    "MEM_LIM:.spec.containers[*].resources.limits.memory",
].join(",");

// Joins live `top pods` usage with each pod's CPU/memory requests, side by side, so you can
// eyeball pressure (usage vs request) per pod. Usage and requests come from separate calls,
// merged by pod name in awk; missing usage shows "-", missing requests show "<none>".
function podUsageVsRequests(ctx, ns) {
    const reqCols = "custom-columns=N:.metadata.name,CR:.spec.containers[*].resources.requests.cpu,MR:.spec.containers[*].resources.requests.memory";
    const join = `awk '$1=="@@@"{p=1;next} p==0{u1[$1]=$2;u2[$1]=$3;n[$1]=1;next} {r1[$1]=$2;r2[$1]=$3;n[$1]=1} END{for(k in n) print k,(u1[k]?u1[k]:"-"),(r1[k]?r1[k]:"-"),(u2[k]?u2[k]:"-"),(r2[k]?r2[k]:"-")}'`;
    return `{ echo "POD CPU CPU_REQ MEM MEM_REQ"; { kubectl --context=${ctx} --namespace=${ns} top pods --no-headers 2>/dev/null; echo @@@; kubectl --context=${ctx} --namespace=${ns} get pods --no-headers -o '${reqCols}'; } | ${join} | sort; } | column -t`;
}

export function buildResourcesCommands(ctx, ns) {
    return [
        {
            group: "Resources",
            name: `Top pods  ${DIM}(CPU/memory usage)${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "top", "pods"]),
        },
        {
            group: "Resources",
            name: `Top nodes  ${DIM}(cluster-wide)${RESET}`,
            run: () => runLiveWithOptionalWatch("kubectl", [`--context=${ctx}`, "top", "nodes"]),
        },
        {
            group: "Resources",
            name: `Top pods — per container, by CPU  ${DIM}(highest first)${RESET}`,
            run: () =>
                runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "top", "pods", "--containers", "--sort-by=cpu"]),
        },
        {
            group: "Resources",
            name: `Top pods — per container, by memory  ${DIM}(highest first)${RESET}`,
            run: () =>
                runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "top", "pods", "--containers", "--sort-by=memory"]),
        },
        {
            group: "Resources",
            name: `Pod requests & limits  ${DIM}(configured CPU/memory)${RESET}`,
            run: () =>
                runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "get", "pods", "-o", `custom-columns=${REQ_LIMIT_COLUMNS}`]),
        },
        {
            group: "Resources",
            name: `Pod usage vs requests  ${DIM}(live usage beside requests)${RESET}`,
            run: () => runShell(podUsageVsRequests(ctx, ns)),
        },
    ];
}
