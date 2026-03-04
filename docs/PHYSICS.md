resonance is a self-organized radio ecology.

Traditional platforms set up servers that distribute content that users consume. resonance sets up a 
field in which agents interact, patterns emerge from those interactions and culture appears.

The resonance Field

We define a continuous state space R(x, t), where x is the abstract position in cultural space, t is 
time and R is a measure of resonance intensity (activity + attention).

R is a multidimensional latent space composed of: sonic similarity, social proximity, shared 
listening history, and temporal synchrony.

Agents

Each participant is an agent with state:

Agent_i:
Position p_i
Velocity v_i
Attention A_i
Bandwidth B_i
Identity signature S_i

Interpretation:
Position: musical/cultural location
Velocity: taste drift over time
Attention: listening energy
Bandwidth: relay capacity

## The Physics Engine: Mathematical Implementation

To render the multidimensional latent space $\mathcal{R}$ on a 2D Canvas, we conceptualize the field 
using principles loosely analogous to the **Holographic Principle** (e.g., AdS/CFT correspondence). 
The $N$-dimensional bulk (containing sonic, social, and historical data) is projected onto a 
lower-dimensional boundary (the 2D Canvas). The distance $D_{canvas}(i, j)$ is a compressed 
representation of the true latent distance $D_{latent}(i, j)$.

$$D_{latent}(i, j) = w_1 d_{sonic} + w_2 d_{social} + w_3 d_{history} + w_4 d_{time}$$

### Kinematics
The movement of an agent $i$ is governed by a set of forces $F_{total}$ acting upon it. We use 
second-order overdamped kinematics where velocity is directly proportional to force (to prevent 
chaotic orbital slingshotting in the UI).
$$\frac{dp_i}{dt} = v_i(t) \propto F_{total, i}$$

### 1. Alignment (Spin-Wave Behavioural Inertia)
Instead of standard Boids flocking (which transports matter/agents), the resonance field propagates *information* via **Spin-Wave Theory**, referencing Attanasi et al. (2014) on starling flocks. A 
change in taste or direction by one agent ripples rapidly through the network without requiring the 
agents themselves to swap positions immediately.

We assign each agent a continuous internal state or "spin" $\vec{s}_i$ (representing their current 
taste vector). The alignment force $F_{align}$ acts to minimize the exchange energy Hamiltonian:
$$H_{align} = - J \sum_{i \sim j} \vec{s}_i \cdot \vec{s}_j$$
Information propagates as a wave according to the linearized equations of motion:
$$\frac{d^2 \vec{s}_i}{dt^2} = c^2 \nabla^2 \vec{s}_i - \gamma \frac{d\vec{s}_i}{dt}$$
*(Where $c$ is the speed of information transfer—the "sound" of the flock—and $\gamma$ is the 
damping/behavioral inertia).* This creates beautiful, rapid ripples of taste alignment across the 
visual field before the particles physically move.

### 2. Attraction (Cultural Gravity)
Broadcast Nodes pull listeners. The pull is proportional to the Node's active Energy $E_j(t)$.
$$F_{attract, i} = \sum_{j \in Nodes} G \frac{E_j(t) \cdot m_i}{D_{canvas}(i,j)^2} \hat{u}_{ij}$$

### 3. Repulsion (Anti-Monopoly)
To prevent massive center-weighted monopolies, dense nodes exert outward pressure.
$$F_{repulse, i} = - C_{repulse} \cdot (\rho(p_i))^2 \hat{u}_{ij}$$
*(Where $\rho$ is local listener density. This causes megastreams to fracture into distinct 
sub-scenes or visual halos).*

### 4. Noise (Exploration)
Stochastic drift prevents agents from getting stuck in local minima.
$$F_{noise, i} = \mathcal{N}(0, \sigma^2)$$

### 5. User Override ($F_{user}$)
We prioritize agency. When a user actively moves their mouse or touches the screen to navigate, an 
overwhelming directional force $F_{user}$ is applied, breaking the agent out of gravity wells and 
spin-wave alignment.
$$F_{total, i} = \begin{cases} 
F_{user} & \text{if User is interacting} \\
F_{align} + F_{attract} + F_{repulse} + F_{noise} & \text{if User is idle}
\end{cases}$$
When the user releases control, they regain inertia and the emergent forces smoothly take over.

### 6. Cold-Start Spawning
When a brand new user $i$ arrives (where $d_{history} = 0$, $d_{social} = 0$), they need an initial 
$p_i(0)$. 
We use **Geolocalization as the initial prior**. The 2D canvas is lightly seeded with a geographic 
topological bias (e.g., agents from Tokyo spawn in a similar regional cluster). This gives them an 
immediate, local spin-wave context before they drift based on sonic preference.

---

## Broadcasts as Energy Sources (Thermodynamics)

A live broadcast $B$ injects energy into the field.
$$E_B(t) = \begin{cases} 
E_{base} + \alpha \cdot \text{Listeners}(t) & \text{if Live} \\
E_{final} \cdot e^{-\lambda (t - t_{end})} & \text{if Ended} 
\end{cases}$$
Old shows leave fading attractors—cultural memory.

## Emergent Phenomena
If tuned correctly:
- **Waves:** Genres appear as rapidly moving spin-waves of attention changing color/alignment.
- **Swarms:** Temporary scenes from around live events.
- **Constellations:** Long-term communities stabilize.

## Interface Blueprint
The UI is a visualization of the physics—it reveals the invisible dynamics.
- **Main Screen:** Dark space, glowing oscillating nodes, flowing particle paths, rapid spin-wave 
ripples lighting up sections of the network.
- **Listening:** Approaching a node fades audio in spatially (`useSpatialAudio`). You clearly see 
WebRTC connections form as thin glowing edges.
- **No Menus:** You navigate by physically moving your avatar.